import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSourceService } from './data-source.service';
import { DB_SERVICE } from '../db/db.interface';

// 32-byte key expressed as 64 hex chars — deterministic for tests
const TEST_KEY = 'a'.repeat(64);

const mockDb = {
  query: jest.fn(),
  execute: jest.fn(),
  executeOut: jest.fn(),
  executeBatch: jest.fn(),
};

describe('DataSourceService', () => {
  let service: DataSourceService;

  beforeEach(async () => {
    process.env['DS_ENCRYPTION_KEY'] = TEST_KEY;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataSourceService,
        { provide: DB_SERVICE, useValue: mockDb },
      ],
    }).compile();

    service = module.get(DataSourceService);
    jest.clearAllMocks();
    mockDb.execute.mockResolvedValue(undefined);
  });

  afterAll(() => {
    delete process.env['DS_ENCRYPTION_KEY'];
  });

  describe('register', () => {
    it('inserts a row with encrypted connection config', async () => {
      const id = await service.register({
        name: 'My Oracle DS',
        sourceType: 'oracle',
        connectionConfig: { host: 'localhost', port: 1521 },
      });

      expect(typeof id).toBe('string');
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
      const [sql, binds] = mockDb.execute.mock.calls[0] as [string, Record<string, unknown>];
      expect(sql).toMatch(/INSERT INTO DATA_SOURCES/i);
      // Encrypted value is not the raw JSON
      expect(binds['connectionConfig']).not.toContain('"host"');
      // But it is a colon-separated hex string (iv:tag:ciphertext)
      expect((binds['connectionConfig'] as string).split(':')).toHaveLength(3);
    });
  });

  describe('list', () => {
    it('returns sources without connectionConfig', async () => {
      mockDb.query.mockResolvedValue([
        {
          ID: 'abc',
          NAME: 'DS1',
          SOURCE_TYPE: 'csv',
          CONNECTION_CONFIG: '{}',
          CREATED_BY: null,
          CREATED_AT: '2024-01-01T00:00:00Z',
        },
      ]);

      const result = await service.list();
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('connectionConfig');
      expect(result[0]?.name).toBe('DS1');
    });
  });

  describe('getById', () => {
    it('throws NotFoundException when not found', async () => {
      mockDb.query.mockResolvedValue([]);
      await expect(service.getById('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('decrypts connectionConfig from unencrypted fixture (csv mode)', async () => {
      mockDb.query.mockResolvedValue([
        {
          ID: 'abc',
          NAME: 'DS1',
          SOURCE_TYPE: 'rest_api',
          // In CSV fixture mode the config is plain JSON (not encrypted)
          CONNECTION_CONFIG: JSON.stringify({ url: 'https://api.example.com' }),
          CREATED_BY: null,
          CREATED_AT: '2024-01-01T00:00:00Z',
        },
      ]);
      const ds = await service.getById('abc');
      expect(ds.connectionConfig).toEqual({ url: 'https://api.example.com' });
    });
  });

  describe('delete', () => {
    it('deletes existing source', async () => {
      mockDb.query.mockResolvedValue([{ ID: 'abc' }]);
      await service.delete('abc');
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringMatching(/DELETE FROM DATA_SOURCES/i),
        expect.objectContaining({ id: 'abc' }),
      );
    });

    it('throws NotFoundException when source missing', async () => {
      mockDb.query.mockResolvedValue([]);
      await expect(service.delete('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('testConnection', () => {
    const baseRow = {
      ID: 'abc',
      NAME: 'DS',
      CREATED_BY: null,
      CREATED_AT: '2024-01-01T00:00:00Z',
    };

    it('returns ok for csv source type', async () => {
      mockDb.query.mockResolvedValue([
        { ...baseRow, SOURCE_TYPE: 'csv', CONNECTION_CONFIG: '{}' },
      ]);
      const result = await service.testConnection('abc');
      expect(result.ok).toBe(true);
    });

    it('calls SELECT 1 FROM DUAL for oracle source type', async () => {
      mockDb.query
        .mockResolvedValueOnce([
          { ...baseRow, SOURCE_TYPE: 'oracle', CONNECTION_CONFIG: '{}' },
        ])
        .mockResolvedValueOnce([{ 1: 1 }]); // DUAL response

      const result = await service.testConnection('abc');
      expect(result.ok).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT 1 FROM DUAL');
    });

    it('returns ok: false when oracle query throws', async () => {
      mockDb.query
        .mockResolvedValueOnce([
          { ...baseRow, SOURCE_TYPE: 'oracle', CONNECTION_CONFIG: '{}' },
        ])
        .mockRejectedValueOnce(new Error('ORA-12541: TNS no listener'));

      const result = await service.testConnection('abc');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('ORA-12541');
    });

    it('validates postgresql config fields', async () => {
      mockDb.query.mockResolvedValue([
        {
          ...baseRow,
          SOURCE_TYPE: 'postgresql',
          CONNECTION_CONFIG: JSON.stringify({ host: 'pg-host', port: 5432, database: 'mydb' }),
        },
      ]);
      const result = await service.testConnection('abc');
      expect(result.ok).toBe(true);
      expect(result.message).toContain('pg-host');
    });
  });
});
