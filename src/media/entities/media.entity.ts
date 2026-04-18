export interface Media {
  id: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  storageDriver: string;
  storagePath: string;
  uploadedBy: string | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface MediaVariant {
  id: string;
  mediaId: string;
  variant: 'thumbnail' | 'small' | 'medium' | 'large';
  storagePath: string;
  width: number | null;
  height: number | null;
}
