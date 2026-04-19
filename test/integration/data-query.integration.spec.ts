// @csv-mode — Oracle source driver replaced by CSV driver reading fixture data; Valkey replaced by
// a mock Redis client to test cache hit/miss behaviour without a real Redis connection.
jest.setTimeout(15000);

import { Test, TestingModule } from '@nestjs/testing';
import { QueryEngineService } from '../../src/data-viz/query-engine.service';
import { DataSourceService } from '../../src/data-viz/data-source.service';
import { DB_SERVICE, IDbService } from '../../src/db/db.interface';
import { VALKEY_CLIENT } from '../../src/auth/auth.constants';
import type { DataSource } from '../../src/data-viz/data-source.entity';
import type { QueryConfig, Row } from '../../src/data-viz/drivers/driver.interface';

const FIXTURE_ROWS: Row[] = [
  { page_id: 'aaa', title: 'Page A', view_count: 10, helpful_votes: 7 },
  { page_id: 'bbb', title: 'Page B', view_count: 5, helpful_votes: 3 },
  { page_id: 'ccc', title: 'Page C', view_count: 20, helpful_votes: 15 },
];

const SOURCE_ID = 'src-csv-001';

const MOCK_SOURCE: DataSource = {
  id: SOURCE_ID,
  name: 'Analytics CSV',
  sourceType: 'csv',
  connectionConfig: { data: FIXTURE_ROWS },
  createdAt: new Date(),
  createdBy: null,
};

const QUERY: QueryConfig = { sql: 'SELECT * FROM rows' };

describe('Data query with cache integration (csv-mode)', () => {
  let engine: QueryEngineService;
  let mockRedis: Record<string, string>;

  beforeAll(async () => {
    const db: jest.Mocked<IDbService> = {
      query: jest.fn().mockResolvedValue(FIXTURE_ROWS),
      execute: jest.fn().mockResolvedValue(undefined),
      executeBatch: jest.fn().mockResolvedValue(undefined),
      executeOut: jest.fn().mockResolvedValue({}),
    };

    const dataSourceService = {
      getById: jest.fn().mockResolvedValue(MOCK_SOURCE),
    } as unknown as DataSourceService;

    // In-memory Redis mock: supports get/set/del commands used by QueryEngineService
    mockRedis = {};
    const redisMock = {
      get: jest.fn(async (key: string) => mockRedis[key] ?? null),
      set: jest.fn(async (key: string, val: string, _ex: string, _ttl: number) => { mockRedis[key] = val; return 'OK'; }),
      del: jest.fn(async (key: string) => { delete mockRedis[key]; return 1; }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        QueryEngineService,
        { provide: DataSourceService, useValue: dataSourceService },
        { provide: DB_SERVICE, useValue: db },
        { provide: VALKEY_CLIENT, useValue: redisMock },
      ],
    }).compile();

    engine = moduleRef.get(QueryEngineService);
  });

  beforeEach(() => {
    // Clear cache between tests
    Object.keys(mockRedis).forEach((k) => { delete mockRedis[k]; });
  });

  it('first query returns fixture rows with meta.cached = false', async () => {
    const result = await engine.execute(SOURCE_ID, QUERY);
    expect(result.meta.cached).toBe(false);
    expect(result.data).toHaveLength(FIXTURE_ROWS.length);
    expect(result.data[0]).toMatchObject({ page_id: 'aaa' });
  });

  it('second identical query returns cached result with meta.cached = true', async () => {
    await engine.execute(SOURCE_ID, QUERY); // populate cache
    const result2 = await engine.execute(SOURCE_ID, QUERY); // cache hit
    expect(result2.meta.cached).toBe(true);
    expect(result2.data).toHaveLength(FIXTURE_ROWS.length);
  });

  it('after cache cleared, query returns meta.cached = false again', async () => {
    await engine.execute(SOURCE_ID, QUERY); // populate cache
    // Manually delete the cache key
    const cacheKey = Object.keys(mockRedis)[0];
    if (cacheKey) delete mockRedis[cacheKey];

    const result = await engine.execute(SOURCE_ID, QUERY);
    expect(result.meta.cached).toBe(false);
  });

  it('different query config produces separate cache entries', async () => {
    const queryA: QueryConfig = { sql: 'SELECT a FROM rows' };
    const queryB: QueryConfig = { sql: 'SELECT b FROM rows' };

    await engine.execute(SOURCE_ID, queryA);
    await engine.execute(SOURCE_ID, queryB);

    expect(Object.keys(mockRedis)).toHaveLength(2);
  });

  it('query_ms is a non-negative number', async () => {
    const result = await engine.execute(SOURCE_ID, QUERY);
    expect(result.meta.query_ms).toBeGreaterThanOrEqual(0);
  });
});
