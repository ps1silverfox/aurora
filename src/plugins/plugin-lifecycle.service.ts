import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import * as path from 'path';
import { DB_SERVICE, IDbService } from '../db/db.interface';
import { EVENT_PUBLISHER, IEventPublisher } from '../events/event-publisher.interface';
import { Plugin, PluginRow, rowToPlugin } from './plugin.entity';
import { ContentService } from '../content/content.service';
import { AuditService } from '../audit/audit.service';
import { PluginSandboxService, SandboxedPluginApi } from './plugin-sandbox.service';
import { BlockRegistry } from './block-registry';
import { PluginRouteRegistry } from './plugin-route-registry';

export interface PluginContext {
  content: Pick<ContentService, 'listPages' | 'getPage'>;
  audit: Pick<AuditService, 'log'>;
  db: Pick<IDbService, 'query'>;
  sandbox: SandboxedPluginApi;
}

interface LoadedPlugin {
  activate(ctx: PluginContext): Promise<void> | void;
  deactivate(): Promise<void> | void;
}

@Injectable()
export class PluginLifecycleService {
  private readonly logger = new Logger(PluginLifecycleService.name);
  private readonly pluginsDir = path.join(process.cwd(), 'plugins');
  private readonly loaded = new Map<string, LoadedPlugin>();

  constructor(
    @Inject(DB_SERVICE) private readonly db: IDbService,
    @Inject(EVENT_PUBLISHER) private readonly events: IEventPublisher,
    private readonly content: ContentService,
    private readonly audit: AuditService,
    private readonly sandboxService: PluginSandboxService,
    private readonly blockRegistry: BlockRegistry,
    private readonly routeRegistry: PluginRouteRegistry,
  ) {}

  async install(dir: string): Promise<Plugin> {
    const manifestPath = path.join(this.pluginsDir, dir, 'plugin.json');
    let manifest: unknown;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      manifest = require(manifestPath) as unknown;
    } catch {
      throw new BadRequestException(`Cannot read plugin.json in "${dir}"`);
    }

    const m = manifest as Record<string, unknown>;
    await this.db.execute(
      `INSERT INTO PLUGINS (NAME, VERSION, STATUS, MANIFEST)
       VALUES (:name, :version, 'inactive', :manifest)`,
      {
        name: m['name'],
        version: m['version'],
        manifest: JSON.stringify(manifest),
      },
    );

    const rows = await this.db.query<PluginRow>(
      'SELECT ID, NAME, VERSION, STATUS, MANIFEST, INSTALLED_AT, ACTIVATED_AT FROM PLUGINS WHERE NAME = :name',
      { name: m['name'] },
    );
    if (!rows[0]) throw new Error('Plugin not found after insert');
    return rowToPlugin(rows[0]);
  }

  async activate(id: string): Promise<Plugin> {
    const plugin = await this.findById(id);
    if (plugin.status === 'active') return plugin;

    const entrypoint = path.join(this.pluginsDir, plugin.name, plugin.manifest.entrypoint);
    let mod: LoadedPlugin;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const required = require(entrypoint) as { default?: LoadedPlugin } | LoadedPlugin;
      mod = ('default' in required && required.default ? required.default : required) as LoadedPlugin;
    } catch (err) {
      await this.db.execute("UPDATE PLUGINS SET STATUS = 'error' WHERE ID = :id", { id });
      throw new BadRequestException(`Failed to load plugin "${plugin.name}": ${String(err)}`);
    }

    const ctx = this.buildContext(id, plugin.manifest);
    try {
      await mod.activate(ctx);
    } catch (err) {
      await this.db.execute("UPDATE PLUGINS SET STATUS = 'error' WHERE ID = :id", { id });
      throw new BadRequestException(`Plugin "${plugin.name}" activate() threw: ${String(err)}`);
    }

    this.loaded.set(id, mod);

    await this.db.execute(
      "UPDATE PLUGINS SET STATUS = 'active', ACTIVATED_AT = SYSDATE WHERE ID = :id",
      { id },
    );

    this.events.publish('plugin.activated', { id, name: plugin.name });
    this.logger.log(`Plugin "${plugin.name}" activated`);

    return this.findById(id);
  }

  async deactivate(id: string): Promise<Plugin> {
    const plugin = await this.findById(id);
    if (plugin.status !== 'active') return plugin;

    const mod = this.loaded.get(id);
    if (mod) {
      try {
        await mod.deactivate();
      } catch (err) {
        this.logger.warn(`Plugin "${plugin.name}" deactivate() threw: ${String(err)}`);
      }
      this.loaded.delete(id);
    }

    this.blockRegistry.unregisterByPlugin(plugin.name);
    this.routeRegistry.unregisterPlugin(plugin.name);

    await this.db.execute("UPDATE PLUGINS SET STATUS = 'inactive' WHERE ID = :id", { id });
    this.events.publish('plugin.deactivated', { id, name: plugin.name });
    this.logger.log(`Plugin "${plugin.name}" deactivated`);

    return this.findById(id);
  }

  async uninstall(id: string): Promise<void> {
    const plugin = await this.findById(id);
    if (plugin.status === 'active') {
      await this.deactivate(id);
    }
    await this.db.execute('DELETE FROM PLUGINS WHERE ID = :id', { id });
    this.logger.log(`Plugin "${plugin.name}" uninstalled`);
  }

  async listAll(): Promise<Plugin[]> {
    const rows = await this.db.query<PluginRow>(
      'SELECT ID, NAME, VERSION, STATUS, MANIFEST, INSTALLED_AT, ACTIVATED_AT FROM PLUGINS ORDER BY NAME',
    );
    return rows.map(rowToPlugin);
  }

  async findByName(name: string): Promise<Plugin | undefined> {
    const rows = await this.db.query<PluginRow>(
      'SELECT ID, NAME, VERSION, STATUS, MANIFEST, INSTALLED_AT, ACTIVATED_AT FROM PLUGINS WHERE NAME = :name',
      { name },
    );
    return rows[0] ? rowToPlugin(rows[0]) : undefined;
  }

  private async findById(id: string): Promise<Plugin> {
    const rows = await this.db.query<PluginRow>(
      'SELECT ID, NAME, VERSION, STATUS, MANIFEST, INSTALLED_AT, ACTIVATED_AT FROM PLUGINS WHERE ID = :id',
      { id },
    );
    if (!rows[0]) throw new NotFoundException(`Plugin "${id}" not found`);
    return rowToPlugin(rows[0]);
  }

  private buildContext(pluginId: string, manifest: import('./plugin.entity').PluginManifest): PluginContext {
    return {
      content: {
        listPages: this.content.listPages.bind(this.content),
        getPage: this.content.getPage.bind(this.content),
      },
      audit: {
        log: this.audit.log.bind(this.audit),
      },
      db: {
        query: this.db.query.bind(this.db),
      },
      sandbox: this.sandboxService.buildSandboxedApi(pluginId, manifest),
    };
  }
}
