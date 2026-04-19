import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PluginLifecycleService } from './plugin-lifecycle.service';
import { DB_SERVICE } from '../db/db.interface';
import { EVENT_PUBLISHER } from '../events/event-publisher.interface';
import { ContentService } from '../content/content.service';
import { AuditService } from '../audit/audit.service';

// Block real require() calls to plugins/
jest.mock('path', () => {
  const actual = jest.requireActual<typeof import('path')>('path');
  return { ...actual };
});

const validManifest = {
  name: 'test-plugin',
  version: '1.0.0',
  entrypoint: 'index.js',
  permissions: ['content.read'],
  hooks: [],
  blocks: [],
  routes: [],
  settings: [],
};

const inactiveRow = {
  ID: 'plugin-id-1',
  NAME: 'test-plugin',
  VERSION: '1.0.0',
  STATUS: 'inactive',
  MANIFEST: JSON.stringify(validManifest),
  INSTALLED_AT: new Date().toISOString(),
  ACTIVATED_AT: null,
};

const activeRow = { ...inactiveRow, STATUS: 'active', ACTIVATED_AT: new Date().toISOString() };

const mockDb = {
  query: jest.fn(),
  execute: jest.fn(),
  executeOut: jest.fn(),
  executeBatch: jest.fn(),
};

const mockEvents = { publish: jest.fn() };

const mockContent = {
  listPages: jest.fn(),
  getPage: jest.fn(),
} as unknown as ContentService;

const mockAudit = { log: jest.fn() } as unknown as AuditService;

describe('PluginLifecycleService', () => {
  let service: PluginLifecycleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginLifecycleService,
        { provide: DB_SERVICE, useValue: mockDb },
        { provide: EVENT_PUBLISHER, useValue: mockEvents },
        { provide: ContentService, useValue: mockContent },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get(PluginLifecycleService);
    jest.clearAllMocks();
    mockDb.execute.mockResolvedValue(undefined);
  });

  describe('listAll()', () => {
    it('returns mapped plugins from DB', async () => {
      mockDb.query.mockResolvedValue([inactiveRow]);
      const result = await service.listAll();
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('test-plugin');
      expect(result[0]?.status).toBe('inactive');
    });

    it('returns empty array when no plugins', async () => {
      mockDb.query.mockResolvedValue([]);
      const result = await service.listAll();
      expect(result).toEqual([]);
    });
  });

  describe('activate()', () => {
    it('throws NotFoundException for unknown plugin', async () => {
      mockDb.query.mockResolvedValue([]);
      await expect(service.activate('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('returns plugin unchanged if already active', async () => {
      mockDb.query.mockResolvedValue([activeRow]);
      const result = await service.activate('plugin-id-1');
      expect(result.status).toBe('active');
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('sets status=error and throws BadRequestException when entrypoint cannot be loaded', async () => {
      mockDb.query.mockResolvedValue([inactiveRow]);
      await expect(service.activate('plugin-id-1')).rejects.toThrow(BadRequestException);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE PLUGINS SET STATUS = 'error'/i),
        expect.objectContaining({ id: 'plugin-id-1' }),
      );
    });
  });

  describe('deactivate()', () => {
    it('throws NotFoundException for unknown plugin', async () => {
      mockDb.query.mockResolvedValue([]);
      await expect(service.deactivate('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('returns plugin unchanged if already inactive', async () => {
      mockDb.query.mockResolvedValue([inactiveRow]);
      const result = await service.deactivate('plugin-id-1');
      expect(result.status).toBe('inactive');
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('deactivates active plugin, sets status=inactive, publishes event', async () => {
      const postDeactivateRow = { ...inactiveRow, STATUS: 'inactive' };
      mockDb.query
        .mockResolvedValueOnce([activeRow])
        .mockResolvedValueOnce([postDeactivateRow]);

      const result = await service.deactivate('plugin-id-1');
      expect(result.status).toBe('inactive');
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE PLUGINS SET STATUS = 'inactive'/i),
        expect.objectContaining({ id: 'plugin-id-1' }),
      );
      expect(mockEvents.publish).toHaveBeenCalledWith('plugin.deactivated', expect.objectContaining({ id: 'plugin-id-1' }));
    });

    it('deactivates loaded plugin module (calls deactivate())', async () => {
      const postDeactivateRow = { ...inactiveRow, STATUS: 'inactive' };
      mockDb.query
        .mockResolvedValueOnce([activeRow])
        .mockResolvedValueOnce([postDeactivateRow]);

      // Pre-load a fake module into the service's loaded map
      const fakeMod = { activate: jest.fn(), deactivate: jest.fn().mockResolvedValue(undefined) };
      (service as unknown as { loaded: Map<string, unknown> }).loaded.set('plugin-id-1', fakeMod);

      await service.deactivate('plugin-id-1');
      expect(fakeMod.deactivate).toHaveBeenCalled();
    });
  });

  describe('uninstall()', () => {
    it('throws NotFoundException for unknown plugin', async () => {
      mockDb.query.mockResolvedValue([]);
      await expect(service.uninstall('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('deletes inactive plugin from DB', async () => {
      mockDb.query.mockResolvedValue([inactiveRow]);
      await service.uninstall('plugin-id-1');
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringMatching(/DELETE FROM PLUGINS WHERE ID/i),
        expect.objectContaining({ id: 'plugin-id-1' }),
      );
    });

    it('deactivates active plugin before deleting', async () => {
      const postDeactivateRow = { ...inactiveRow, STATUS: 'inactive' };
      mockDb.query
        .mockResolvedValueOnce([activeRow])   // findById in uninstall
        .mockResolvedValueOnce([activeRow])   // findById in deactivate
        .mockResolvedValueOnce([postDeactivateRow]); // findById after deactivate UPDATE

      await service.uninstall('plugin-id-1');

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE PLUGINS SET STATUS = 'inactive'/i),
        expect.objectContaining({ id: 'plugin-id-1' }),
      );
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringMatching(/DELETE FROM PLUGINS WHERE ID/i),
        expect.objectContaining({ id: 'plugin-id-1' }),
      );
    });
  });

  describe('install()', () => {
    it('throws BadRequestException when plugin.json cannot be read', async () => {
      await expect(service.install('bad-plugin')).rejects.toThrow(BadRequestException);
    });
  });
});
