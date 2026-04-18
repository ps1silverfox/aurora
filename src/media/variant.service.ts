import { Inject, Injectable } from '@nestjs/common';
import * as path from 'path';
import * as crypto from 'crypto';
import sharp from 'sharp';
import { DB_SERVICE, IDbService } from '../db/db.interface';
import { StorageDriver, STORAGE_DRIVER } from './storage/storage.interface';
import { MediaVariant } from './entities/media.entity';

const VARIANT_SIZES = {
  thumbnail: 150,
  small: 300,
  medium: 768,
  large: 1200,
} as const;

type VariantName = keyof typeof VARIANT_SIZES;

// SVG (vector) and non-raster formats are excluded — sharp cannot resize them reliably
const PROCESSABLE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
]);

function uuidToRaw(uuid: string): string {
  return uuid.replace(/-/g, '').toUpperCase();
}

function rawToUuid(hex: string): string {
  const h = hex.replace(/-/g, '').toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function variantStoragePath(sourcePath: string, variant: VariantName): string {
  const ext = path.extname(sourcePath);
  const base = sourcePath.slice(0, sourcePath.length - ext.length);
  return `${base}_${variant}${ext}`;
}

@Injectable()
export class VariantService {
  constructor(
    @Inject(DB_SERVICE) private readonly db: IDbService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  async generateVariants(
    mediaId: string,
    sourcePath: string,
    mimeType: string,
  ): Promise<MediaVariant[]> {
    if (!PROCESSABLE_IMAGE_TYPES.has(mimeType)) return [];

    const sourceBuffer = await this.storage.read(sourcePath);
    const variants: MediaVariant[] = [];

    for (const [variantName, width] of Object.entries(VARIANT_SIZES) as [VariantName, number][]) {
      const { data, info } = await sharp(sourceBuffer)
        .resize(width, undefined, { withoutEnlargement: true })
        .toBuffer({ resolveWithObject: true });

      const vPath = variantStoragePath(sourcePath, variantName);

      await this.storage.upload(
        { originalname: path.basename(vPath), mimetype: mimeType, size: data.length, buffer: data },
        vPath,
      );

      await this.db.execute(
        `INSERT INTO MEDIA_VARIANTS (MEDIA_ID, VARIANT, STORAGE_PATH, WIDTH, HEIGHT)
         VALUES (HEXTORAW(:mediaId), :variant, :storagePath, :width, :height)`,
        {
          mediaId: uuidToRaw(mediaId),
          variant: variantName,
          storagePath: vPath,
          width: info.width,
          height: info.height,
        },
      );

      const rows = await this.db.query<{ ID: string }>(
        `SELECT RAWTOHEX(ID) AS ID FROM MEDIA_VARIANTS
         WHERE MEDIA_ID = HEXTORAW(:mediaId) AND VARIANT = :variant`,
        { mediaId: uuidToRaw(mediaId), variant: variantName },
      );

      const id = rows[0] ? rawToUuid(rows[0].ID) : crypto.randomUUID();
      variants.push({
        id,
        mediaId,
        variant: variantName,
        storagePath: vPath,
        width: info.width,
        height: info.height,
      });
    }

    return variants;
  }
}
