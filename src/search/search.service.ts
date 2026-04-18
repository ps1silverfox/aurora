import { Injectable, Inject } from '@nestjs/common';
import { DB_SERVICE, IDbService } from '../db/db.interface';
import { CursorPage, encodeCursor, decodeCursor } from '../common/pagination';

export interface SearchResult {
  id: string;
  title: string;
  slug: string;
  score: number;
  publishedAt: Date | null;
}

export interface SearchFilters {
  query: string;
  status?: string;
  cursor?: string;
  limit?: number;
}

function rawToUuid(raw: Buffer | string): string {
  return raw.toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

@Injectable()
export class SearchService {
  constructor(@Inject(DB_SERVICE) private readonly db: IDbService) {}

  async index(pageId: string): Promise<void> {
    // Oracle Text CONTEXT index syncs via SYNC_INDEX; here we touch the row to trigger ON COMMIT sync
    const rawId = pageId.replace(/-/g, '');
    await this.db.execute(
      `UPDATE PAGES SET UPDATED_AT = SYSTIMESTAMP WHERE ID = HEXTORAW(:id)`,
      { id: rawId },
    );
  }

  async search(filters: SearchFilters): Promise<CursorPage<SearchResult>> {
    const limit = Math.min(filters.limit ?? 20, 100);
    const cursorData = filters.cursor ? decodeCursor(filters.cursor) : null;
    const cursorScore = cursorData ? (cursorData['score'] as number) : null;
    const cursorId = cursorData ? (cursorData['id'] as string) : null;

    const statusClause = filters.status ? `AND p.STATUS = :status` : '';
    const cursorClause =
      cursorScore != null
        ? `AND (SCORE(1) < :cursorScore OR (SCORE(1) = :cursorScore AND p.ID > HEXTORAW(:cursorId)))`
        : '';

    const binds: Record<string, unknown> = { query: filters.query, limit: limit + 1 };
    if (filters.status) binds['status'] = filters.status;
    if (cursorScore != null) {
      binds['cursorScore'] = cursorScore;
      binds['cursorId'] = (cursorId ?? '').replace(/-/g, '');
    }

    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT p.ID, p.TITLE, p.SLUG, SCORE(1) AS RELEVANCE_SCORE, p.PUBLISHED_AT
       FROM PAGES p
       WHERE CONTAINS(p.TITLE || ' ' || p.SLUG, :query, 1) > 0
         AND p.DELETED_AT IS NULL
         ${statusClause}
         ${cursorClause}
       ORDER BY SCORE(1) DESC, p.ID ASC
       FETCH FIRST :limit ROWS ONLY`,
      binds,
    );

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const data: SearchResult[] = pageRows.map((row) => ({
      id: rawToUuid(row['ID'] as Buffer | string),
      title: row['TITLE'] as string,
      slug: row['SLUG'] as string,
      score: Number(row['RELEVANCE_SCORE']),
      publishedAt: row['PUBLISHED_AT'] ? new Date(row['PUBLISHED_AT'] as string) : null,
    }));

    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && lastRow
        ? encodeCursor({ score: Number(lastRow['RELEVANCE_SCORE']), id: rawToUuid(lastRow['ID'] as Buffer | string) })
        : null;

    return { data, nextCursor, prevCursor: null };
  }

  async remove(pageId: string): Promise<void> {
    // Soft-delete from search: mark page deleted so CONTENT_SEARCH_VIEW excludes it
    const rawId = pageId.replace(/-/g, '');
    await this.db.execute(
      `UPDATE PAGES SET DELETED_AT = SYSTIMESTAMP WHERE ID = HEXTORAW(:id) AND DELETED_AT IS NULL`,
      { id: rawId },
    );
  }
}
