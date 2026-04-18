// @csv-mode
import { Test } from '@nestjs/testing';
import { SearchService } from './search.service';
import { DB_SERVICE } from '../db/db.interface';

const mockDb = {
  query: jest.fn(),
  execute: jest.fn(),
  executeBatch: jest.fn(),
  executeOut: jest.fn().mockResolvedValue({}),
};

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: DB_SERVICE, useValue: mockDb },
      ],
    }).compile();
    service = module.get(SearchService);
  });

  describe('index', () => {
    it('calls execute with UPDATE PAGES statement', async () => {
      mockDb.execute.mockResolvedValue(undefined);
      await service.index('550e8400-e29b-41d4-a716-446655440000');
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE PAGES'),
        expect.objectContaining({ id: expect.any(String) }),
      );
    });
  });

  describe('search', () => {
    it('calls query with CONTAINS predicate and returns mapped results', async () => {
      const fakeId = Buffer.from('550e8400e29b41d4a716446655440000', 'hex');
      mockDb.query.mockResolvedValue([
        { ID: fakeId, TITLE: 'Hello World', SLUG: 'hello-world', RELEVANCE_SCORE: 85, PUBLISHED_AT: '2024-01-01T00:00:00Z' },
      ]);

      const result = await service.search({ query: 'hello', limit: 20 });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('CONTAINS'),
        expect.objectContaining({ query: 'hello' }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.title).toBe('Hello World');
      expect(result.data[0]?.score).toBe(85);
      expect(result.nextCursor).toBeNull();
    });

    it('sets nextCursor when more results exist than limit', async () => {
      const makeRow = (i: number) => ({
        ID: Buffer.from(`550e8400e29b41d4a71644665544000${i}`.padEnd(32, '0'), 'hex'),
        TITLE: `Page ${i}`,
        SLUG: `page-${i}`,
        RELEVANCE_SCORE: 90 - i,
        PUBLISHED_AT: null,
      });
      // Return limit+1 rows to trigger pagination
      mockDb.query.mockResolvedValue(Array.from({ length: 3 }, (_, i) => makeRow(i)));

      const result = await service.search({ query: 'page', limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.nextCursor).not.toBeNull();
    });

    it('applies status filter when provided', async () => {
      mockDb.query.mockResolvedValue([]);
      await service.search({ query: 'test', status: 'published' });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining(':status'),
        expect.objectContaining({ status: 'published' }),
      );
    });
  });

  describe('remove', () => {
    it('calls execute with UPDATE PAGES SET DELETED_AT statement', async () => {
      mockDb.execute.mockResolvedValue(undefined);
      await service.remove('550e8400-e29b-41d4-a716-446655440000');
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETED_AT'),
        expect.objectContaining({ id: expect.any(String) }),
      );
    });
  });
});
