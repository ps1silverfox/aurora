// @csv-mode
import { Test, TestingModule } from '@nestjs/testing';
import { QueryEngineService } from './query-engine.service';
import { DataSourceService } from './data-source.service';
import { DB_SERVICE } from '../db/db.interface';
import { VALKEY_CLIENT } from '../auth/auth.constants';

const TEST_KEY = 'a'.repeat(64);

const mockDb = {
  query: jest.fn(),
  execute: jest.fn(),
  executeOut: jest.fn(),
  executeBatch: jest.fn(),
};

const mockDataSourceService = {
  getById: jest.fn(),
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
};

describe('QueryEngineService', () => {
  let service: QueryEngineService;

  beforeEach(async () => {
    process.env['DS_ENCRYPTION_KEY'] = TEST_KEY;
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryEngineService,
        { provide: DB_SERVICE, useValue: mockDb },
        { provide: DataSourceService, useValue: mockDataSourceService },
        { provide: VALKEY_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<QueryEngineService>(QueryEngineService);
  });

  describe('Oracle driver', () => {
    it('calls DbService.query with SELECT and ROW_NUMBER()', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDataSourceService.getById.mockResolvedValue({
        id: 'src-1',
        sourceType: 'oracle',
        connectionConfig: {},
      });
      mockDb.query.mockResolvedValue([{ NAME: 'Alice', RN__: 1 }]);

      const result = await service.execute('src-1', { sql: 'SELECT * FROM USERS' }, 0);

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const [sql] = mockDb.query.mock.calls[0] as [string, unknown];
      expect(sql.toUpperCase()).toContain('SELECT');
      expect(sql.toUpperCase()).toContain('ROW_NUMBER()');
      expect(result.data).toEqual([{ NAME: 'Alice' }]);
      expect(result.meta.cached).toBe(false);
    });

    it('throws when non-SELECT sql is supplied', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDataSourceService.getById.mockResolvedValue({
        id: 'src-1',
        sourceType: 'oracle',
        connectionConfig: {},
      });

      await expect(
        service.execute('src-1', { sql: 'DROP TABLE USERS' }, 0),
      ).rejects.toThrow('Oracle driver only allows SELECT queries');
    });
  });

  describe('CSV driver', () => {
    it('parses CSV data and returns rows', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDataSourceService.getById.mockResolvedValue({
        id: 'src-csv',
        sourceType: 'csv',
        connectionConfig: { data: 'id,name\n1,Alice\n2,Bob' },
      });

      const result = await service.execute('src-csv', {}, 0);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({ id: 1, name: 'Alice' });
      expect(result.meta.cached).toBe(false);
    });
  });

  describe('Valkey cache', () => {
    it('returns cached=true on second identical call', async () => {
      const cachedRows = [{ id: 1, name: 'Alice' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedRows));
      mockDataSourceService.getById.mockResolvedValue({
        id: 'src-1',
        sourceType: 'oracle',
        connectionConfig: {},
      });

      const result = await service.execute('src-1', { sql: 'SELECT * FROM USERS' });

      expect(result.meta.cached).toBe(true);
      expect(result.data).toEqual(cachedRows);
      // DB should not be called when cache hits
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('stores result in Valkey after fresh query', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockDataSourceService.getById.mockResolvedValue({
        id: 'src-2',
        sourceType: 'csv',
        connectionConfig: { data: 'x\n1' },
      });

      await service.execute('src-2', {}, 30);

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^dq:/),
        expect.any(String),
        'EX',
        30,
      );
    });
  });
});
