import { Inject, Injectable, Optional } from '@nestjs/common';
import type Redis from 'ioredis';
import { VALKEY_CLIENT } from '../auth/auth.constants';
import { DB_SERVICE, IDbService } from '../db/db.interface';

function uuidToRaw(uuid: string): string {
  return uuid.replace(/-/g, '').toUpperCase();
}

interface RatingAggRow {
  TOTAL: number;
  HELPFUL_SUM: number;
}

@Injectable()
export class KnowledgeBaseService {
  constructor(
    @Inject(DB_SERVICE) private readonly db: IDbService,
    @Optional() @Inject(VALKEY_CLIENT) private readonly redis: Redis | undefined,
  ) {}

  async viewPage(pageId: string, ip: string): Promise<void> {
    if (this.redis) {
      const key = `view:${pageId}:${ip}`;
      const exists = await this.redis.get(key);
      if (exists) return;
      await this.redis.set(key, '1', 'EX', 3600);
    }
    await this.db.execute(
      `UPDATE PAGES SET VIEW_COUNT = VIEW_COUNT + 1
       WHERE ID = HEXTORAW(:id) AND DELETED_AT IS NULL`,
      { id: uuidToRaw(pageId) },
    );
  }

  async ratePage(pageId: string, helpful: boolean): Promise<void> {
    await this.db.execute(
      `INSERT INTO PAGE_RATINGS (ID, PAGE_ID, HELPFUL)
       VALUES (SYS_GUID(), HEXTORAW(:pageId), :helpful)`,
      { pageId: uuidToRaw(pageId), helpful: helpful ? 1 : 0 },
    );
  }

  async getHelpfulPct(pageId: string): Promise<number | null> {
    const rows = await this.db.query<RatingAggRow>(
      `SELECT COUNT(*) AS TOTAL, SUM(HELPFUL) AS HELPFUL_SUM
       FROM PAGE_RATINGS WHERE PAGE_ID = HEXTORAW(:id)`,
      { id: uuidToRaw(pageId) },
    );
    const row = rows[0];
    if (!row || row.TOTAL === 0) return null;
    return Math.round((row.HELPFUL_SUM / row.TOTAL) * 100);
  }
}
