import { Test, TestingModule } from '@nestjs/testing';
import { PluginDiscoveryService } from './plugin-discovery.service';
import { DB_SERVICE } from '../db/db.interface';

// Mock fs/promises at module level
jest.mock('fs/promises');
import * as fs from 'fs/promises';

const mockDb = {
  query: jest.fn(),
  execute: jest.fn(),
  executeOut: jest.fn(),
  executeBatch: jest.fn(),
};

const validManifest = {
  name: 'seo-plugin',
  version: '1.0.0',
  entrypoint: 'index.js',
  permissions: ['content.read'],
  hooks: ['content.published'],
  blocks: [],
  routes: [],
  settings: [],
};

const pluginRow = {
  ID: 'abc123',
  NAME: 'seo-plugin',
  VERSION: '1.0.0',
  STATUS: 'inactive',
  MANIFEST: JSON.stringify(validManifest),
  INSTALLED_AT: new Date().toISOString(),
  ACTIVATED_AT: null,
};

describe('PluginDiscoveryService', () => {
  let service: PluginDiscoveryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginDiscoveryService,
        { provide: DB_SERVICE, useValue: mockDb },
      ],
    }).compile();

    service = module.get(PluginDiscoveryService);
    jest.clearAllMocks();
    mockDb.execute.mockResolvedValue(undefined);
  });

  describe('discover()', () => {
    it('returns empty array when plugins/ directory does not exist', async () => {
      (fs.readdir as jest.Mock).mockRejectedValue(new Error('ENOENT'));
      const result = await service.discover();
      expect(result).toEqual([]);
    });

    it('scans plugins dir, reads plugin.json, syncs to DB, returns plugins', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['seo-plugin']);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(validManifest));
      // No existing record — INSERT path
      mockDb.query
        .mockResolvedValueOnce([]) // SELECT in syncPlugin (check existing)
        .mockResolvedValueOnce([pluginRow]); // SELECT after INSERT

      const result = await service.discover();

      expect(result).toHaveLength(1);
      const plugin = result[0];
      expect(plugin?.name).toBe('seo-plugin');
      expect(plugin?.status).toBe('inactive');
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO PLUGINS/i),
        expect.objectContaining({ name: 'seo-plugin', version: '1.0.0' }),
      );
    });

    it('updates existing plugin record when already in DB', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['seo-plugin']);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(validManifest));
      mockDb.query
        .mockResolvedValueOnce([pluginRow]) // SELECT: found
        .mockResolvedValueOnce([pluginRow]); // SELECT after UPDATE

      await service.discover();

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE PLUGINS/i),
        expect.objectContaining({ name: 'seo-plugin' }),
      );
    });

    it('skips plugin with invalid manifest and continues', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['bad-plugin', 'seo-plugin']);
      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify({ name: 'bad-plugin' })) // missing fields
        .mockResolvedValueOnce(JSON.stringify(validManifest));
      mockDb.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([pluginRow]);

      const result = await service.discover();

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('seo-plugin');
    });

    it('skips plugin when plugin.json read fails and continues', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['broken-plugin', 'seo-plugin']);
      (fs.readFile as jest.Mock)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce(JSON.stringify(validManifest));
      mockDb.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([pluginRow]);

      const result = await service.discover();

      expect(result).toHaveLength(1);
    });
  });

  describe('listFromDb()', () => {
    it('returns plugins mapped from DB rows', async () => {
      mockDb.query.mockResolvedValue([pluginRow]);
      const result = await service.listFromDb();
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('abc123');
      expect(result[0]?.manifest.entrypoint).toBe('index.js');
    });

    it('returns empty array when no plugins in DB', async () => {
      mockDb.query.mockResolvedValue([]);
      const result = await service.listFromDb();
      expect(result).toEqual([]);
    });
  });
});
