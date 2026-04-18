import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DB_SERVICE, IDbService } from '../db/db.interface';
import { Theme, ThemeManifest } from './theme.entity';

interface ThemeRow {
  ID: string;
  NAME: string;
  SLUG: string;
  PATH: string;
  IS_ACTIVE: string;
  SETTINGS: string;
  CREATED_AT: string;
}

function rowToTheme(row: ThemeRow): Theme {
  return {
    id: Number(row.ID),
    name: row.NAME,
    slug: row.SLUG,
    path: row.PATH,
    isActive: row.IS_ACTIVE === '1',
    settings: row.SETTINGS ? (JSON.parse(row.SETTINGS) as Record<string, unknown>) : {},
    createdAt: new Date(row.CREATED_AT),
  };
}

@Injectable()
export class ThemeService {
  private readonly logger = new Logger(ThemeService.name);
  private readonly themesDir = path.join(process.cwd(), 'themes');

  constructor(@Inject(DB_SERVICE) private readonly db: IDbService) {}

  async discover(): Promise<Theme[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.themesDir);
    } catch {
      return [];
    }

    const themes: Theme[] = [];
    for (const entry of entries) {
      const manifestPath = path.join(this.themesDir, entry, 'theme.json');
      try {
        const raw = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(raw) as ThemeManifest;
        themes.push({
          id: 0,
          name: manifest.name,
          slug: manifest.slug,
          path: path.join(this.themesDir, entry),
          isActive: false,
          settings: {},
          createdAt: new Date(),
        });
      } catch {
        this.logger.debug(`Skipping ${entry}: no valid theme.json`);
      }
    }

    // Merge DB records (active state, settings, assigned IDs)
    const rows = await this.db.query<ThemeRow>(
      `SELECT ID, NAME, SLUG, PATH, IS_ACTIVE, SETTINGS, CREATED_AT FROM THEMES ORDER BY ID`,
    );
    for (const row of rows) {
      const match = themes.find((t) => t.slug === row.SLUG);
      if (match) {
        match.id = Number(row.ID);
        match.isActive = row.IS_ACTIVE === '1';
        match.settings = row.SETTINGS ? (JSON.parse(row.SETTINGS) as Record<string, unknown>) : {};
        match.createdAt = new Date(row.CREATED_AT);
      }
    }

    return themes;
  }

  async getActive(): Promise<Theme | null> {
    const rows = await this.db.query<ThemeRow>(
      `SELECT ID, NAME, SLUG, PATH, IS_ACTIVE, SETTINGS, CREATED_AT FROM THEMES WHERE IS_ACTIVE = 1`,
    );
    if (rows.length === 0) {
      // Fall back to first discovered theme
      const all = await this.discover();
      return all[0] ?? null;
    }
    return rowToTheme(rows[0] as ThemeRow);
  }

  async activate(id: number): Promise<void> {
    await this.db.execute(`UPDATE THEMES SET IS_ACTIVE = 0`);
    await this.db.execute(`UPDATE THEMES SET IS_ACTIVE = 1 WHERE ID = :id`, { id });
  }

  async getSettings(id: number): Promise<Record<string, unknown>> {
    const rows = await this.db.query<ThemeRow>(
      `SELECT SETTINGS FROM THEMES WHERE ID = :id`,
      { id },
    );
    if (rows.length === 0) throw new NotFoundException(`Theme ${id} not found`);
    const row = rows[0] as ThemeRow;
    return row.SETTINGS ? (JSON.parse(row.SETTINGS) as Record<string, unknown>) : {};
  }

  async updateSettings(id: number, settings: Record<string, unknown>): Promise<void> {
    const rows = await this.db.query<ThemeRow>(
      `SELECT ID FROM THEMES WHERE ID = :id`,
      { id },
    );
    if (rows.length === 0) throw new NotFoundException(`Theme ${id} not found`);
    await this.db.execute(
      `UPDATE THEMES SET SETTINGS = :settings WHERE ID = :id`,
      { settings: JSON.stringify(settings), id },
    );
  }
}
