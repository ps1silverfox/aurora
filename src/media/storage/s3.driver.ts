import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { StorageDriver, UploadedFile } from './storage.interface';

@Injectable()
export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly baseUrl: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET ?? 'aurora-media';
    const region = process.env.S3_REGION ?? 'us-east-1';
    const endpoint = process.env.S3_ENDPOINT;
    this.baseUrl = process.env.S3_CDN_URL ?? `https://${this.bucket}.s3.${region}.amazonaws.com`;
    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
  }

  async upload(file: UploadedFile, storagePath: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }),
    );
    return storagePath;
  }

  async delete(storagePath: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: storagePath }),
    );
  }

  url(storagePath: string): string {
    return `${this.baseUrl}/${storagePath}`;
  }
}
