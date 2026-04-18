import { Controller, Get, Inject, Query } from '@nestjs/common';
import { DB_SERVICE, IDbService } from '../db/db.interface';

export interface ContentAnalyticsRow {
  contentId: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  authorId: string;
  contentType: string;
  revisionCount: number;
  lastRevisedAt: string | null;
  refreshedAt: string;
}

interface ContentAnalyticsMvRow {
  CONTENT_ID: string;
  SLUG: string;
  STATUS: string;
  PUBLISHED_AT: string | null;
  AUTHOR_ID: string;
  CONTENT_TYPE: string;
  REVISION_COUNT: string | number;
  LAST_REVISED_AT: string | null;
  REFRESHED_AT: string;
}

@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(@Inject(DB_SERVICE) private readonly db: IDbService) {}

  // @csv-mode
  @Get('content')
  async getContentAnalytics(
    @Query('status') status?: string,
    @Query('contentType') contentType?: string,
  ): Promise<{ data: ContentAnalyticsRow[] }> {
    const rows = await this.db.query<ContentAnalyticsMvRow>(
      `SELECT CONTENT_ID, SLUG, STATUS, PUBLISHED_AT, AUTHOR_ID,
              CONTENT_TYPE, REVISION_COUNT, LAST_REVISED_AT, REFRESHED_AT
       FROM CONTENT_ANALYTICS_MV
       ORDER BY PUBLISHED_AT DESC NULLS LAST`,
    );

    const data = rows
      .filter((r) => !status || r.STATUS === status)
      .filter((r) => !contentType || r.CONTENT_TYPE === contentType)
      .map(
        (r): ContentAnalyticsRow => ({
          contentId: r.CONTENT_ID,
          slug: r.SLUG,
          status: r.STATUS,
          publishedAt: r.PUBLISHED_AT ?? null,
          authorId: r.AUTHOR_ID,
          contentType: r.CONTENT_TYPE,
          revisionCount: Number(r.REVISION_COUNT),
          lastRevisedAt: r.LAST_REVISED_AT ?? null,
          refreshedAt: r.REFRESHED_AT,
        }),
      );

    return { data };
  }
}
