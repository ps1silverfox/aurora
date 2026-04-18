import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { DB_SERVICE } from '../db/db.interface';

const FIXTURE_ROWS = [
  {
    CONTENT_ID: '550e8400-e29b-41d4-a716-446655440001',
    SLUG: 'hello-world',
    STATUS: 'published',
    PUBLISHED_AT: '2026-01-15T10:00:00Z',
    AUTHOR_ID: '550e8400-e29b-41d4-a716-446655440011',
    CONTENT_TYPE: 'page',
    REVISION_COUNT: '3',
    LAST_REVISED_AT: '2026-01-20T14:30:00Z',
    REFRESHED_AT: '2026-04-18T00:00:00Z',
  },
  {
    CONTENT_ID: '550e8400-e29b-41d4-a716-446655440002',
    SLUG: 'about-us',
    STATUS: 'published',
    PUBLISHED_AT: '2026-01-16T09:00:00Z',
    AUTHOR_ID: '550e8400-e29b-41d4-a716-446655440011',
    CONTENT_TYPE: 'page',
    REVISION_COUNT: '5',
    LAST_REVISED_AT: '2026-02-01T11:00:00Z',
    REFRESHED_AT: '2026-04-18T00:00:00Z',
  },
  {
    CONTENT_ID: '550e8400-e29b-41d4-a716-446655440003',
    SLUG: 'draft-post',
    STATUS: 'draft',
    PUBLISHED_AT: null,
    AUTHOR_ID: '550e8400-e29b-41d4-a716-446655440012',
    CONTENT_TYPE: 'post',
    REVISION_COUNT: '1',
    LAST_REVISED_AT: '2026-03-10T08:00:00Z',
    REFRESHED_AT: '2026-04-18T00:00:00Z',
  },
];

const mockDb = {
  query: jest.fn(),
  execute: jest.fn(),
  executeOut: jest.fn(),
  executeBatch: jest.fn(),
};

describe('AnalyticsController', () => {
  // @csv-mode
  let controller: AnalyticsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: DB_SERVICE, useValue: mockDb }],
    }).compile();

    controller = module.get(AnalyticsController);
    jest.clearAllMocks();
    mockDb.query.mockResolvedValue(FIXTURE_ROWS);
  });

  describe('getContentAnalytics', () => {
    it('returns all rows when no filters applied', async () => {
      const result = await controller.getContentAnalytics();

      expect(result.data).toHaveLength(3);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM CONTENT_ANALYTICS_MV'),
      );
    });

    it('maps DB column names to camelCase response shape', async () => {
      const result = await controller.getContentAnalytics();
      const row = result.data.find((r) => r.slug === 'hello-world');

      expect(row).toMatchObject({
        contentId: '550e8400-e29b-41d4-a716-446655440001',
        slug: 'hello-world',
        status: 'published',
        publishedAt: '2026-01-15T10:00:00Z',
        authorId: '550e8400-e29b-41d4-a716-446655440011',
        contentType: 'page',
        revisionCount: 3,
        lastRevisedAt: '2026-01-20T14:30:00Z',
        refreshedAt: '2026-04-18T00:00:00Z',
      });
    });

    it('casts REVISION_COUNT string to number', async () => {
      const result = await controller.getContentAnalytics();
      const row = result.data.find((r) => r.slug === 'hello-world');
      expect(typeof row?.revisionCount).toBe('number');
      expect(row?.revisionCount).toBe(3);
    });

    it('filters by status query param', async () => {
      const result = await controller.getContentAnalytics('draft');

      expect(result.data).toHaveLength(1);
      expect(result.data.find((r) => r.slug === 'draft-post')).toBeDefined();
    });

    it('filters by contentType query param', async () => {
      const result = await controller.getContentAnalytics(undefined, 'post');

      expect(result.data).toHaveLength(1);
      expect(result.data.find((r) => r.contentType === 'post')).toBeDefined();
    });

    it('combines status and contentType filters', async () => {
      const result = await controller.getContentAnalytics('published', 'page');

      expect(result.data).toHaveLength(2);
      result.data.forEach((r) => {
        expect(r.status).toBe('published');
        expect(r.contentType).toBe('page');
      });
    });

    it('returns empty data array when no rows match filter', async () => {
      const result = await controller.getContentAnalytics('archived');
      expect(result.data).toHaveLength(0);
    });

    it('handles null PUBLISHED_AT gracefully', async () => {
      const result = await controller.getContentAnalytics('draft');
      const row = result.data.find((r) => r.slug === 'draft-post');
      expect(row?.publishedAt).toBeNull();
    });
  });
});
