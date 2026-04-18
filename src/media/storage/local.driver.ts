import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StorageDriver, UploadedFile } from './storage.interface';

const STORAGE_ROOT = path.resolve(process.cwd(), 'storage', 'media');

@Injectable()
export class LocalStorageDriver implements StorageDriver {
  async upload(file: UploadedFile, storagePath: string): Promise<string> {
    const dest = path.join(STORAGE_ROOT, storagePath);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, file.buffer);
    return storagePath;
  }

  async delete(storagePath: string): Promise<void> {
    const dest = path.join(STORAGE_ROOT, storagePath);
    await fs.unlink(dest).catch(() => undefined);
  }

  url(storagePath: string): string {
    return `/media/${storagePath}`;
  }
}
