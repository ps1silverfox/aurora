export const STORAGE_DRIVER = Symbol('StorageDriver');

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface StorageDriver {
  upload(file: UploadedFile, path: string): Promise<string>;
  delete(path: string): Promise<void>;
  url(path: string): string;
}
