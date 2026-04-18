import { Inject, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DB_SERVICE, IDbService } from '../db/db.interface';
import { Plugin, PluginManifest, PluginRow, rowToPlugin } from './plugin.entity';

@Injectable()
export class PluginDiscoveryService {
  private readonly logger = new Logger(PluginDiscoveryService.name);
  private readonly pluginsDir = path.join(process.cwd(), 'plugins');

  constructor(@Inject(DB_SERVICE) private readonly db: IDbService) {}

  async discover(): Promise<Plugin[]> {
    let dirs: string[];
    try {
      dirs = await fs.readdir(this.pluginsDir);
    } catch {
      this.logger.warn('plugins/ directory not found — no plugins loaded');
      return [];
    }

    const discovered: Plugin[] = [];

    for (const dir of dirs) {
      const manifestPath = path.join(this.pluginsDir, dir, 'plugin.json');
      try {
        const raw = await fs.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(raw) as PluginManifest;
        if (!this.isValidManifest(manifest)) {
          this.logger.warn(`Plugin "${dir}" has invalid manifest — skipping`);
          continue;
        }
        const plugin = await this.syncPlugin(manifest);
        discovered.push(plugin);
      } catch (err) {
        this.logger.warn(`Failed to load plugin from "${dir}": ${String(err)}`);
      }
    }

    return discovered;
  }

  async listFromDb(): Promise<Plugin[]> {
    const rows = await this.db.query<PluginRow>(
      'SELECT ID, NAME, VERSION, STATUS, MANIFEST, INSTALLED_AT, ACTIVATED_AT FROM PLUGINS ORDER BY NAME',
    );
    return rows.map(rowToPlugin);
  }

  private async syncPlugin(manifest: PluginManifest): Promise<Plugin> {
    const existing = await this.db.query<PluginRow>(
      'SELECT ID, NAME, VERSION, STATUS, MANIFEST, INSTALLED_AT, ACTIVATED_AT FROM PLUGINS WHERE NAME = :name',
      { name: manifest.name },
    );

    if (existing.length > 0) {
      await this.db.execute(
        'UPDATE PLUGINS SET VERSION = :version, MANIFEST = :manifest WHERE NAME = :name',
        {
          version: manifest.version,
          manifest: JSON.stringify(manifest),
          name: manifest.name,
        },
      );

      const updated = await this.db.query<PluginRow>(
        'SELECT ID, NAME, VERSION, STATUS, MANIFEST, INSTALLED_AT, ACTIVATED_AT FROM PLUGINS WHERE NAME = :name',
        { name: manifest.name },
      );
      if (!updated[0]) throw new Error(`Plugin "${manifest.name}" not found after update`);
      return rowToPlugin(updated[0]);
    }

    await this.db.execute(
      `INSERT INTO PLUGINS (NAME, VERSION, STATUS, MANIFEST)
       VALUES (:name, :version, 'inactive', :manifest)`,
      {
        name: manifest.name,
        version: manifest.version,
        manifest: JSON.stringify(manifest),
      },
    );

    const inserted = await this.db.query<PluginRow>(
      'SELECT ID, NAME, VERSION, STATUS, MANIFEST, INSTALLED_AT, ACTIVATED_AT FROM PLUGINS WHERE NAME = :name',
      { name: manifest.name },
    );
    if (!inserted[0]) throw new Error(`Plugin "${manifest.name}" not found after insert`);
    return rowToPlugin(inserted[0]);
  }

  private isValidManifest(m: unknown): m is PluginManifest {
    if (typeof m !== 'object' || m === null) return false;
    const obj = m as Record<string, unknown>;
    return (
      typeof obj['name'] === 'string' &&
      typeof obj['version'] === 'string' &&
      typeof obj['entrypoint'] === 'string' &&
      Array.isArray(obj['permissions']) &&
      Array.isArray(obj['hooks']) &&
      Array.isArray(obj['blocks']) &&
      Array.isArray(obj['routes']) &&
      Array.isArray(obj['settings'])
    );
  }
}
