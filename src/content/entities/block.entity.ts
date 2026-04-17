export interface Block {
  id: string;
  pageId: string;
  blockType: string;
  blockOrder: number;
  content: Record<string, unknown>;
  createdAt: Date;
}
