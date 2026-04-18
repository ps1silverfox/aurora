import { BlockInput } from '../content.repository';

export interface Revision {
  id: string;
  pageId: string;
  title: string;
  blocks: BlockInput[];
  createdBy: string | null;
  createdAt: Date;
}
