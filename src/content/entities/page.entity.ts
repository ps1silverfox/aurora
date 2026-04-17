export type PageStatus = 'draft' | 'review' | 'approved' | 'published' | 'archived';

export interface Page {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  authorId: string | null;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
