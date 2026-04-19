// @csv-mode — plugin records held in an in-memory mock DB; no Oracle connection needed
jest.setTimeout(15000);

import * as path from 'path';
import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PluginLifecycleService } from '../../src/plugins/plugin-lifecycle.service';
import { PluginSandboxService } from '../../src/plugins/plugin-sandbox.service';
import { BlockRegistry } from '../../src/plugins/block-registry';
import { PluginRouteRegistry } from '../../src/plugins/plugin-route-registry';
import { HookManager } from '../../src/plugins/hook-manager';
import { DB_SERVICE, IDbService } from '../../src/db/db.interface';
import { EVENT_PUBLISHER, IEventPublisher } from '../../src/events/event-publisher.interface';
import { ContentService } from '../../src/content/content.service';
import { AuditService } from '../../src/audit/audit.service';
import { VALKEY_CLIENT } from '../../src/auth/auth.constants';
import type { PluginRow } from '../../src/plugins/plugin.entity';

// Path to the test plugin installed on disk
const PLUGIN_DIR = 'test-plugin';
const PLUGIN_MODULE_PATH = path.join(process.cwd(), 'plugins', PLUGIN_DIR, 'index.js');

// ---------------------------------------------------------------------------
// In-memory plugin DB mock
// ---------------------------------------------------------------------------
function makePluginDb(): jest.Mocked<IDbService> {
  const rows: PluginRow[] = [];

  const db = {
    query: jest.fn((sql: string, params?: Record<string, unknown>) => {
      if (/FROM PLUGINS/i.test(sql)) {
        if (/WHERE NAME\s*=\s*:name/i.test(sql)) {
          return rows.filter((r) => r.NAME === (params?.['name'] as string));
        }
        if (/WHERE ID\s*=\s*:id/i.test(sql)) {
          return rows.filter((r) => r.ID === (params?.['id'] as string));
        }
        return [...rows];
      }
      return [];
    }),
    execute: jest.fn((sql: string, params?: Record<string, unknown>) => {
      if (/INSERT INTO PLUGINS/i.test(sql)) {
        rows.push({
          ID: crypto.randomUUID().replace(/-/g, '').toUpperCase(),
          NAME: params?.['name'] as string,
          VERSION: params?.['version'] as string,
          STATUS: 'inactive',
          MANIFEST: params?.['manifest'] as string,
          INSTALLED_AT: new Date().toISOString(),
          ACTIVATED_AT: null,
        });
      } else if (/UPDATE PLUGINS SET STATUS/i.test(sql)) {
        const id = params?.['id'] as string;
        const statusMatch = /SET STATUS\s*=\s*'(\w+)'/i.exec(sql);
        const status = statusMatch?.[1] ?? 'inactive';
        const row = rows.find((r) => r.ID === id);
        if (row) {
          row.STATUS = status;
          if (/ACTIVATED_AT/i.test(sql)) row.ACTIVATED_AT = new Date().toISOString();
        }
      }
    }),
    executeBatch: jest.fn().mockResolvedValue(undefined),
    executeOut: jest.fn().mockResolvedValue({}),
  } as unknown as jest.Mocked<IDbService>;

  return db;
}

describe('Plugin lifecycle integration (csv-mode)', () => {
  let lifecycle: PluginLifecycleService;
  let hookManager: HookManager;
  let publishedEvents: Array<{ topic: string; payload: unknown }>;

  beforeEach(async () => {
    // Clear require cache for test plugin so each test starts fresh
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete require.cache[PLUGIN_MODULE_PATH];
    publishedEvents = [];

    const mockEvents: IEventPublisher = {
      publish: jest.fn((topic: string, payload: unknown) => {
        publishedEvents.push({ topic, payload });
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PluginLifecycleService,
        PluginSandboxService,
        BlockRegistry,
        PluginRouteRegistry,
        HookManager,
        { provide: DB_SERVICE, useValue: makePluginDb() },
        { provide: EVENT_PUBLISHER, useValue: mockEvents },
        { provide: ContentService, useValue: { listPages: jest.fn(), getPage: jest.fn() } },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: VALKEY_CLIENT, useValue: null },
      ],
    }).compile();

    lifecycle = moduleRef.get(PluginLifecycleService);
    hookManager = moduleRef.get(HookManager);
  });

  it('install registers plugin as inactive', async () => {
    const plugin = await lifecycle.install(PLUGIN_DIR);
    expect(plugin.name).toBe('test-plugin');
    expect(plugin.status).toBe('inactive');
    expect(plugin.version).toBe('1.0.0');
  });

  it('activate transitions plugin to active and publishes plugin.activated', async () => {
    const installed = await lifecycle.install(PLUGIN_DIR);
    const activated = await lifecycle.activate(installed.id);

    expect(activated.status).toBe('active');
    expect(publishedEvents).toContainEqual(
      expect.objectContaining({ topic: 'plugin.activated' }),
    );
  });

  it('content.published hook fires after plugin activated', async () => {
    const installed = await lifecycle.install(PLUGIN_DIR);
    await lifecycle.activate(installed.id);

    // Attach spy via module export — hook callback checks __spy at call time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pluginMod = require(PLUGIN_MODULE_PATH) as { __spy: jest.Mock | null };
    const spy = jest.fn();
    pluginMod.__spy = spy;

    await hookManager.doAction('content.published', { id: 'page-1', title: 'Hello' });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ id: 'page-1', title: 'Hello' });
  });

  it('deactivate removes hook — subsequent publish does not call spy', async () => {
    const installed = await lifecycle.install(PLUGIN_DIR);
    await lifecycle.activate(installed.id);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pluginMod = require(PLUGIN_MODULE_PATH) as { __spy: jest.Mock | null };
    const spy = jest.fn();
    pluginMod.__spy = spy;

    await lifecycle.deactivate(installed.id);

    await hookManager.doAction('content.published', { id: 'page-2' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('deactivate transitions plugin to inactive and publishes plugin.deactivated', async () => {
    const installed = await lifecycle.install(PLUGIN_DIR);
    await lifecycle.activate(installed.id);
    const deactivated = await lifecycle.deactivate(installed.id);

    expect(deactivated.status).toBe('inactive');
    expect(publishedEvents.map((e) => e.topic)).toContain('plugin.deactivated');
  });

  it('activating already-active plugin is idempotent', async () => {
    const installed = await lifecycle.install(PLUGIN_DIR);
    await lifecycle.activate(installed.id);
    const second = await lifecycle.activate(installed.id);
    expect(second.status).toBe('active');
    expect(publishedEvents.filter((e) => e.topic === 'plugin.activated')).toHaveLength(1);
  });
});
