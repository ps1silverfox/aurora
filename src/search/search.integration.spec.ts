// @csv-mode
import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { DB_SERVICE } from '../db/db.interface';
import { RolesGuard } from '../users/roles.guard';
import { ValidationError } from '../common/errors';

// Integration test: SearchController wired with a real SearchService backed by mock DB.
// Validates that the full controller→service data flow works end-to-end without Oracle.

const fakeRow = {
  ID: Buffer.from('550e8400e29b41d4a716446655440000', 'hex'),
  TITLE: 'Integration Result',
  SLUG: 'integration-result',
  RELEVANCE_SCORE: 72,
  PUBLISHED_AT: '2025-01-15T00:00:00Z',
};

const mockDb = {
  query: jest.fn(),
  execute: jest.fn(),
  executeBatch: jest.fn(),
  executeOut: jest.fn().mockResolvedValue({}),
};

describe('SearchController (integration)', () => {
  let controller: SearchController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        SearchService,
        { provide: DB_SERVICE, useValue: mockDb },
        { provide: RolesGuard, useValue: { canActivate: () => true } },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(SearchController);
  });

  it('returns mapped SearchResult through real SearchService', async () => {
    mockDb.query.mockResolvedValue([fakeRow]);

    const result = await controller.search('integration', undefined, undefined, undefined);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      title: 'Integration Result',
      slug: 'integration-result',
      score: 72,
    });
    expect(result.nextCursor).toBeNull();
  });

  it('propagates status filter from query param to DbService', async () => {
    mockDb.query.mockResolvedValue([]);

    await controller.search('cms', 'published', undefined, undefined);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining(':status'),
      expect.objectContaining({ status: 'published', query: 'cms' }),
    );
  });

  it('returns empty page when no results', async () => {
    mockDb.query.mockResolvedValue([]);

    const result = await controller.search('nothing', undefined, undefined, undefined);

    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it('throws ValidationError for missing q param (no service call)', async () => {
    await expect(controller.search(undefined, undefined, undefined, undefined)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(mockDb.query).not.toHaveBeenCalled();
  });
});
