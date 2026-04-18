import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IDbService } from './db.interface';

type Row = Record<string, string | null>;

function parseCsvContent(content: string): Row[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const headers = (lines[0] ?? '').split(',').map((h) => h.trim().toUpperCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const row: Row = {};
    headers.forEach((h, i) => {
      row[h] = values[i]?.trim() ?? null;
    });
    return row;
  });
}

function resolveBinds(binds?: Record<string, unknown> | unknown[]): Record<string, unknown> {
  if (!binds) return {};
  if (Array.isArray(binds)) {
    return Object.fromEntries(binds.map((v, i) => [String(i + 1), v]));
  }
  return binds;
}

function toBindString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  return '';
}

function extractTableName(sql: string, keyword: 'FROM' | 'INTO' | 'UPDATE'): string {
  const m = sql.match(new RegExp(`${keyword}\\s+(\\w+)`, 'i'));
  if (!m?.[1]) throw new Error(`Cannot extract table from SQL near "${keyword}"`);
  return m[1].toUpperCase();
}

function buildWhereFilter(
  sql: string,
  binds: Record<string, unknown>,
): (row: Row) => boolean {
  const wm = sql.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|\s*$)/is);
  if (!wm?.[1]) return () => true;

  const conditions = wm[1].split(/\s+AND\s+/i);
  return (row: Row) =>
    conditions.every((cond) => {
      const eq = cond.match(/(\w+)\s*=\s*:(\w+)/i);
      if (!eq) return true;
      const col = (eq[1] ?? '').toUpperCase();
      const bindName = eq[2] ?? '';
      return (row[col] ?? '') === toBindString(binds[bindName]);
    });
}

function selectColumns(row: Row, sql: string): Row {
  const cm = sql.match(/SELECT\s+(.+?)\s+FROM/i);
  if (!cm?.[1]) return row;
  const colClause = cm[1].trim();
  if (colClause === '*') return row;

  const selected: Row = {};
  colClause.split(',').forEach((expr) => {
    const parts = expr.trim().split(/\s+AS\s+/i);
    const srcCol = (parts[0] ?? '').trim().toUpperCase();
    const alias = (parts[1] ?? srcCol).trim().toUpperCase();
    selected[alias] = row[srcCol] ?? null;
  });
  return selected;
}

@Injectable()
export class CsvDriver implements IDbService, OnModuleInit {
  private readonly logger = new Logger(CsvDriver.name);
  private readonly tables = new Map<string, Row[]>();

  async onModuleInit(): Promise<void> {
    const csvDir = path.join(process.cwd(), 'test', 'fixtures', 'csv');
    let files: string[];
    try {
      files = (await fs.readdir(csvDir)).filter((f) => f.endsWith('.csv'));
    } catch {
      this.logger.debug('No CSV fixtures directory — starting with empty tables');
      return;
    }
    for (const file of files) {
      const tableName = path.basename(file, '.csv').toUpperCase();
      const content = await fs.readFile(path.join(csvDir, file), 'utf-8');
      this.tables.set(tableName, parseCsvContent(content));
    }
    this.logger.debug(`Loaded ${files.length} CSV fixture table(s)`);
  }

  query<T>(sql: string, binds?: Record<string, unknown> | unknown[]): Promise<T[]> {
    const resolved = resolveBinds(binds);
    const tableName = extractTableName(sql, 'FROM');
    const rows = this.tables.get(tableName) ?? [];
    const filter = buildWhereFilter(sql, resolved);
    return Promise.resolve(
      rows.filter(filter).map((row) => selectColumns(row, sql)) as unknown as T[],
    );
  }

  execute(sql: string, binds?: Record<string, unknown> | unknown[]): Promise<void> {
    const resolved = resolveBinds(binds);
    const upper = sql.trimStart().toUpperCase();
    if (upper.startsWith('INSERT')) {
      this.handleInsert(sql, resolved);
    } else if (upper.startsWith('UPDATE')) {
      this.handleUpdate(sql, resolved);
    } else if (upper.startsWith('DELETE')) {
      this.handleDelete(sql, resolved);
    }
    // DDL and other statements are no-ops in CSV mode
    return Promise.resolve();
  }

  executeOut(): Promise<Record<string, unknown>> {
    // Oracle AQ dequeue is a no-op in CSV mode — callers treat empty result as no message
    return Promise.resolve({});
  }

  async executeBatch(
    sql: string,
    binds: (Record<string, unknown> | unknown[])[],
  ): Promise<void> {
    for (const b of binds) {
      await this.execute(sql, b);
    }
  }

  private handleInsert(sql: string, binds: Record<string, unknown>): void {
    const tm = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)/i);
    const vm = sql.match(/VALUES\s*\(([^)]+)\)/i);
    if (!tm || !vm) return;

    const tableName = (tm[1] ?? '').toUpperCase();
    const cols = (tm[2] ?? '').split(',').map((c) => c.trim().toUpperCase());
    const vals = (vm[1] ?? '').split(',').map((v) => v.trim());

    const row: Row = {};
    cols.forEach((col, i) => {
      const bm = (vals[i] ?? '').match(/^:(\w+)$/);
      row[col] = bm
        ? toBindString(binds[bm[1] ?? ''])
        : (vals[i] ?? '').replace(/^'|'$/g, '');
    });

    let table = this.tables.get(tableName);
    if (!table) {
      table = [];
      this.tables.set(tableName, table);
    }
    table.push(row);
  }

  private handleUpdate(sql: string, binds: Record<string, unknown>): void {
    const tm = sql.match(/UPDATE\s+(\w+)\s+SET\s+/i);
    if (!tm) return;

    const tableName = (tm[1] ?? '').toUpperCase();
    const rows = this.tables.get(tableName) ?? [];
    const filter = buildWhereFilter(sql, binds);

    const sm = sql.match(/SET\s+(.+?)(?:\s+WHERE|\s*$)/i);
    if (!sm?.[1]) return;

    const assignments = sm[1].split(',').map((a) => {
      const parts = a.split('=').map((s) => s.trim());
      const colPart = parts[0] ?? '';
      const valPart = parts[1];
      const bm = valPart?.match(/^:(\w+)$/);
      return {
        col: colPart.toUpperCase(),
        value: bm
          ? toBindString(binds[bm[1] ?? ''])
          : (valPart ?? '').replace(/^'|'$/g, ''),
      };
    });

    rows.forEach((row) => {
      if (filter(row)) {
        assignments.forEach(({ col, value }) => {
          row[col] = value;
        });
      }
    });
  }

  private handleDelete(sql: string, binds: Record<string, unknown>): void {
    const tableName = extractTableName(sql, 'FROM');
    const rows = this.tables.get(tableName) ?? [];
    const filter = buildWhereFilter(sql, binds);
    this.tables.set(tableName, rows.filter((row) => !filter(row)));
  }

  /** Exposed for testing: direct in-memory table access */
  getTable(name: string): Row[] {
    return this.tables.get(name.toUpperCase()) ?? [];
  }
}
