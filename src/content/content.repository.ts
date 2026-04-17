import { Inject, Injectable } from '@nestjs/common';
import { DB_SERVICE, IDbService } from '../db/db.interface';
import { encodeCursor, decodeCursor, CursorPage } from '../common/pagination';
import { Page, PageStatus } from './entities/page.entity';
import { Block } from './entities/block.entity';

function rawToUuid(hex: string): string {
  const h = hex.replace(/-/g, '').toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function uuidToRaw(uuid: string): string {
  return uuid.replace(/-/g, '').toUpperCase();
}

interface PageRow {
  ID: string;
  TITLE: string;
  SLUG: string;
  STATUS: string;
  AUTHOR_ID: string | null;
  PUBLISHED_AT: Date | null;
  SCHEDULED_AT: Date | null;
  VIEW_COUNT: number;
  CREATED_AT: Date;
  UPDATED_AT: Date;
  DELETED_AT: Date | null;
}

interface BlockRow {
  ID: string;
  PAGE_ID: string;
  BLOCK_TYPE: string;
  BLOCK_ORDER: number;
  CONTENT: string | null;
  CREATED_AT: Date;
}

function mapPage(row: PageRow): Page {
  return {
    id: rawToUuid(row.ID),
    title: row.TITLE,
    slug: row.SLUG,
    status: row.STATUS as PageStatus,
    authorId: row.AUTHOR_ID != null ? rawToUuid(row.AUTHOR_ID) : null,
    publishedAt: row.PUBLISHED_AT ?? null,
    scheduledAt: row.SCHEDULED_AT ?? null,
    viewCount: row.VIEW_COUNT,
    createdAt: row.CREATED_AT,
    updatedAt: row.UPDATED_AT,
    deletedAt: row.DELETED_AT ?? null,
  };
}

function mapBlock(row: BlockRow): Block {
  return {
    id: rawToUuid(row.ID),
    pageId: rawToUuid(row.PAGE_ID),
    blockType: row.BLOCK_TYPE,
    blockOrder: row.BLOCK_ORDER,
    content: row.CONTENT != null ? (JSON.parse(row.CONTENT) as Record<string, unknown>) : {},
    createdAt: row.CREATED_AT,
  };
}

export interface PageFilters {
  status?: PageStatus;
  authorId?: string;
}

export interface CreatePageData {
  title: string;
  slug: string;
  authorId?: string | null;
  scheduledAt?: Date | null;
}

export interface BlockInput {
  blockType: string;
  blockOrder: number;
  content: Record<string, unknown>;
}

@Injectable()
export class ContentRepository {
  constructor(@Inject(DB_SERVICE) private readonly db: IDbService) {}

  async createPage(data: CreatePageData): Promise<Page> {
    await this.db.execute(
      `INSERT INTO PAGES (TITLE, SLUG, AUTHOR_ID, SCHEDULED_AT)
       VALUES (:title, :slug, HEXTORAW(:authorId), :scheduledAt)`,
      {
        title: data.title,
        slug: data.slug,
        authorId: data.authorId != null ? uuidToRaw(data.authorId) : null,
        scheduledAt: data.scheduledAt ?? null,
      },
    );
    const page = await this.findBySlug(data.slug);
    if (!page) throw new Error('Page insert failed');
    return page;
  }

  async findById(id: string): Promise<Page | null> {
    const rows = await this.db.query<PageRow>(
      `SELECT ID, TITLE, SLUG, STATUS, AUTHOR_ID, PUBLISHED_AT, SCHEDULED_AT,
              VIEW_COUNT, CREATED_AT, UPDATED_AT, DELETED_AT
       FROM PAGES
       WHERE ID = HEXTORAW(:id) AND DELETED_AT IS NULL`,
      { id: uuidToRaw(id) },
    );
    const row = rows[0];
    return row != null ? mapPage(row) : null;
  }

  async findBySlug(slug: string): Promise<Page | null> {
    const rows = await this.db.query<PageRow>(
      `SELECT ID, TITLE, SLUG, STATUS, AUTHOR_ID, PUBLISHED_AT, SCHEDULED_AT,
              VIEW_COUNT, CREATED_AT, UPDATED_AT, DELETED_AT
       FROM PAGES
       WHERE SLUG = :slug AND DELETED_AT IS NULL`,
      { slug },
    );
    const row = rows[0];
    return row != null ? mapPage(row) : null;
  }

  async updatePage(
    id: string,
    data: Partial<Pick<Page, 'title' | 'slug' | 'status' | 'publishedAt' | 'scheduledAt'>>,
  ): Promise<Page | null> {
    const setClauses: string[] = ['UPDATED_AT = SYSTIMESTAMP'];
    const binds: Record<string, unknown> = { id: uuidToRaw(id) };

    if (data.title !== undefined) { setClauses.push('TITLE = :title'); binds['title'] = data.title; }
    if (data.slug !== undefined) { setClauses.push('SLUG = :slug'); binds['slug'] = data.slug; }
    if (data.status !== undefined) { setClauses.push('STATUS = :status'); binds['status'] = data.status; }
    if (data.publishedAt !== undefined) { setClauses.push('PUBLISHED_AT = :publishedAt'); binds['publishedAt'] = data.publishedAt; }
    if (data.scheduledAt !== undefined) { setClauses.push('SCHEDULED_AT = :scheduledAt'); binds['scheduledAt'] = data.scheduledAt; }

    await this.db.execute(
      `UPDATE PAGES SET ${setClauses.join(', ')} WHERE ID = HEXTORAW(:id) AND DELETED_AT IS NULL`,
      binds,
    );
    return this.findById(id);
  }

  async softDeletePage(id: string): Promise<void> {
    await this.db.execute(
      `UPDATE PAGES SET DELETED_AT = SYSTIMESTAMP WHERE ID = HEXTORAW(:id) AND DELETED_AT IS NULL`,
      { id: uuidToRaw(id) },
    );
  }

  async listPages(
    filters: PageFilters,
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<Page>> {
    const pageSize = Math.min(limit, 100);
    const binds: Record<string, unknown> = { pageSize: pageSize + 1 };
    const conditions: string[] = ['DELETED_AT IS NULL'];

    if (filters.status !== undefined) {
      conditions.push('STATUS = :status');
      binds['status'] = filters.status;
    }
    if (filters.authorId !== undefined) {
      conditions.push('AUTHOR_ID = HEXTORAW(:authorId)');
      binds['authorId'] = uuidToRaw(filters.authorId);
    }
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded != null && decoded['id'] != null) {
        conditions.push('RAWTOHEX(ID) > :afterId');
        binds['afterId'] = (decoded['id'] as string).toUpperCase();
      }
    }

    const rows = await this.db.query<PageRow>(
      `SELECT ID, TITLE, SLUG, STATUS, AUTHOR_ID, PUBLISHED_AT, SCHEDULED_AT,
              VIEW_COUNT, CREATED_AT, UPDATED_AT, DELETED_AT
       FROM PAGES
       WHERE ${conditions.join(' AND ')}
       ORDER BY CREATED_AT ASC, ID ASC
       FETCH FIRST :pageSize ROWS ONLY`,
      binds,
    );

    const hasNext = rows.length > pageSize;
    const data = rows.slice(0, pageSize).map(mapPage);
    const last = data[data.length - 1];
    const nextCursor =
      hasNext && last != null
        ? encodeCursor({ id: uuidToRaw(last.id) })
        : null;

    return { data, nextCursor, prevCursor: null };
  }

  async upsertBlocks(pageId: string, blocks: BlockInput[]): Promise<void> {
    const rawPageId = uuidToRaw(pageId);
    await this.db.execute(
      `DELETE FROM BLOCKS WHERE PAGE_ID = HEXTORAW(:pageId)`,
      { pageId: rawPageId },
    );
    if (blocks.length === 0) return;
    await this.db.executeBatch(
      `INSERT INTO BLOCKS (PAGE_ID, BLOCK_TYPE, BLOCK_ORDER, CONTENT)
       VALUES (HEXTORAW(:pageId), :blockType, :blockOrder, :content)`,
      blocks.map((b) => ({
        pageId: rawPageId,
        blockType: b.blockType,
        blockOrder: b.blockOrder,
        content: JSON.stringify(b.content),
      })),
    );
  }

  async findBlocksByPageId(pageId: string): Promise<Block[]> {
    const rows = await this.db.query<BlockRow>(
      `SELECT ID, PAGE_ID, BLOCK_TYPE, BLOCK_ORDER, CONTENT, CREATED_AT
       FROM BLOCKS
       WHERE PAGE_ID = HEXTORAW(:pageId)
       ORDER BY BLOCK_ORDER ASC`,
      { pageId: uuidToRaw(pageId) },
    );
    return rows.map(mapBlock);
  }
}
