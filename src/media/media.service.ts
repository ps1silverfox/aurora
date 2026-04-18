import { Inject, Injectable } from '@nestjs/common';
import * as path from 'path';
import * as crypto from 'crypto';
import { DB_SERVICE, IDbService } from '../db/db.interface';
import { AuditService } from '../audit/audit.service';
import { StorageDriver, STORAGE_DRIVER, UploadedFile } from './storage/storage.interface';
import { Media } from './entities/media.entity';
import { encodeCursor, decodeCursor, CursorPage } from '../common/pagination';
import { ValidationError, NotFoundError } from '../common/errors';

const MAX_SIZE_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/tiff',
  'application/pdf',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/flac',
]);

function rawToUuid(hex: string): string {
  const h = hex.replace(/-/g, '').toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function uuidToRaw(uuid: string): string {
  return uuid.replace(/-/g, '').toUpperCase();
}

interface MediaRow {
  ID: string;
  FILENAME: string;
  MIME_TYPE: string | null;
  SIZE_BYTES: number | null;
  STORAGE_DRIVER: string;
  STORAGE_PATH: string;
  UPLOADED_BY: string | null;
  CREATED_AT: Date;
  DELETED_AT: Date | null;
}

function mapRow(row: MediaRow): Media {
  return {
    id: rawToUuid(row.ID),
    filename: row.FILENAME,
    mimeType: row.MIME_TYPE,
    sizeBytes: row.SIZE_BYTES,
    storageDriver: row.STORAGE_DRIVER,
    storagePath: row.STORAGE_PATH,
    uploadedBy: row.UPLOADED_BY != null ? rawToUuid(row.UPLOADED_BY) : null,
    createdAt: row.CREATED_AT,
    deletedAt: row.DELETED_AT ?? null,
  };
}

function buildStoragePath(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const id = crypto.randomUUID().replace(/-/g, '');
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}/${month}/${id}${ext}`;
}

@Injectable()
export class MediaService {
  constructor(
    @Inject(DB_SERVICE) private readonly db: IDbService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly audit: AuditService,
  ) {}

  async upload(file: UploadedFile, uploaderId: string): Promise<Media> {
    if (file.size > MAX_SIZE_BYTES) {
      throw new ValidationError(`File exceeds maximum size of 50MB`);
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new ValidationError(`MIME type '${file.mimetype}' is not allowed`);
    }

    const storageDriver = process.env.STORAGE_DRIVER ?? 'local';
    const storagePath = buildStoragePath(file.originalname);
    await this.storage.upload(file, storagePath);

    const uploaderRaw = uuidToRaw(uploaderId);

    await this.db.execute(
      `INSERT INTO MEDIA (FILENAME, MIME_TYPE, SIZE_BYTES, STORAGE_DRIVER, STORAGE_PATH, UPLOADED_BY)
       VALUES (:filename, :mimeType, :sizeBytes, :storageDriver, :storagePath, HEXTORAW(:uploadedBy))`,
      {
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageDriver,
        storagePath,
        uploadedBy: uploaderRaw,
      },
    );

    const rows = await this.db.query<MediaRow>(
      `SELECT ID, FILENAME, MIME_TYPE, SIZE_BYTES, STORAGE_DRIVER, STORAGE_PATH,
              RAWTOHEX(UPLOADED_BY) AS UPLOADED_BY, CREATED_AT, DELETED_AT
       FROM MEDIA
       WHERE STORAGE_PATH = :storagePath AND DELETED_AT IS NULL`,
      { storagePath },
    );

    const row = rows[0];
    if (!row) throw new Error('Insert failed: media row not found after insert');
    const media = mapRow(row);

    await this.audit.log({
      actorId: uploaderId,
      action: 'media.upload',
      entityType: 'media',
      entityId: media.id,
      diff: { filename: file.originalname, mimeType: file.mimetype, sizeBytes: file.size },
    });

    return media;
  }

  async findById(id: string): Promise<Media> {
    const rows = await this.db.query<MediaRow>(
      `SELECT ID, FILENAME, MIME_TYPE, SIZE_BYTES, STORAGE_DRIVER, STORAGE_PATH,
              RAWTOHEX(UPLOADED_BY) AS UPLOADED_BY, CREATED_AT, DELETED_AT
       FROM MEDIA
       WHERE ID = HEXTORAW(:id) AND DELETED_AT IS NULL`,
      { id: uuidToRaw(id) },
    );
    const row = rows[0];
    if (!row) throw new NotFoundError(`Media ${id} not found`);
    return mapRow(row);
  }

  async list(cursor?: string, limit = 20): Promise<CursorPage<Media>> {
    const pageSize = Math.min(limit, 100);
    const cursorData = cursor ? decodeCursor(cursor) : null;
    const cursorDate: Date | null =
      cursorData && typeof cursorData['createdAt'] === 'string'
        ? new Date(cursorData['createdAt'])
        : null;

    const rows = await this.db.query<MediaRow & { RN: number }>(
      `SELECT * FROM (
         SELECT ID, FILENAME, MIME_TYPE, SIZE_BYTES, STORAGE_DRIVER, STORAGE_PATH,
                RAWTOHEX(UPLOADED_BY) AS UPLOADED_BY, CREATED_AT, DELETED_AT,
                ROW_NUMBER() OVER (ORDER BY CREATED_AT DESC) AS RN
         FROM MEDIA
         WHERE DELETED_AT IS NULL
           AND (:cursorDate IS NULL OR CREATED_AT < :cursorDate)
       ) WHERE RN <= :pageSize`,
      { cursorDate: cursorDate ?? null, pageSize },
    );

    const data = rows.map(mapRow);
    const lastItem = data[data.length - 1];
    const nextCursor =
      data.length === pageSize && lastItem
        ? encodeCursor({ createdAt: lastItem.createdAt.toISOString() })
        : null;

    return { data, nextCursor, prevCursor: null };
  }

  async delete(id: string, actorId: string): Promise<void> {
    const media = await this.findById(id);
    await this.db.execute(
      `UPDATE MEDIA SET DELETED_AT = SYSTIMESTAMP WHERE ID = HEXTORAW(:id)`,
      { id: uuidToRaw(id) },
    );
    await this.storage.delete(media.storagePath).catch(() => undefined);
    await this.audit.log({
      actorId,
      action: 'media.delete',
      entityType: 'media',
      entityId: id,
    });
  }
}
