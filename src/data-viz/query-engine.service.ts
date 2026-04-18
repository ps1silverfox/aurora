import * as crypto from 'node:crypto';
import { Injectable, Inject, Optional, Logger, BadRequestException } from '@nestjs/common';
import type Redis from 'ioredis';
import { DB_SERVICE, IDbService } from '../db/db.interface';
import { VALKEY_CLIENT } from '../auth/auth.constants';
import { DataSourceService } from './data-source.service';
import { QueryConfig, QueryResult, Row, AggregateSpec } from './drivers/driver.interface';
import { OracleDriver } from './drivers/oracle.driver';
import { PostgresqlDriver } from './drivers/postgresql.driver';
import { RestApiDriver } from './drivers/rest-api.driver';
import { CsvDriver } from './drivers/csv.driver';

const DEFAULT_CACHE_TTL = 60; // seconds

function buildCacheKey(sourceId: string, query: QueryConfig): string {
  const payload = JSON.stringify({ sourceId, query });
  return `dq:${crypto.createHash('sha256').update(payload).digest('hex')}`;
}

function applyAggregation(rows: Row[], spec: AggregateSpec): Row[] {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = spec.groupBy.map((col) => {
      const v = row[col];
      if (v == null) return '';
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
      return JSON.stringify(v);
    }).join('\x00');
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  return Array.from(groups.entries()).map(([, bucket]) => {
    const out: Row = {};
    for (const col of spec.groupBy) {
      out[col] = (bucket[0] as Row)[col];
    }
    for (const { fn, column, alias } of spec.functions) {
      const nums = bucket.map((r) => Number(r[column] ?? 0)).filter((n) => !isNaN(n));
      switch (fn) {
        case 'SUM':
          out[alias] = nums.reduce((a, b) => a + b, 0);
          break;
        case 'AVG':
          out[alias] = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
          break;
        case 'COUNT':
          out[alias] = bucket.length;
          break;
        case 'MIN':
          out[alias] = nums.length > 0 ? Math.min(...nums) : null;
          break;
        case 'MAX':
          out[alias] = nums.length > 0 ? Math.max(...nums) : null;
          break;
      }
    }
    return out;
  });
}

function rowsToCsv(rows: Row[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0] as Row);
  const escape = (v: unknown): string => {
    const s = v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))];
  return lines.join('\r\n');
}

@Injectable()
export class QueryEngineService {
  private readonly logger = new Logger(QueryEngineService.name);

  constructor(
    @Inject(DB_SERVICE) private readonly db: IDbService,
    private readonly dataSourceService: DataSourceService,
    @Optional() @Inject(VALKEY_CLIENT) private readonly redis: Redis | undefined,
  ) {}

  async execute(sourceId: string, query: QueryConfig, cacheTtl = DEFAULT_CACHE_TTL): Promise<QueryResult> {
    const cacheKey = buildCacheKey(sourceId, query);

    if (this.redis) {
      const hit = await this.redis.get(cacheKey);
      if (hit) {
        return { data: JSON.parse(hit) as Row[], meta: { cached: true, query_ms: 0 } };
      }
    }

    const dataSource = await this.dataSourceService.getById(sourceId);
    const t0 = Date.now();
    let rows: Row[];

    switch (dataSource.sourceType) {
      case 'oracle':
        rows = await new OracleDriver(this.db).execute(dataSource.connectionConfig, query);
        break;
      case 'postgresql':
        rows = await new PostgresqlDriver().execute(dataSource.connectionConfig, query);
        break;
      case 'rest_api':
        rows = await new RestApiDriver().execute(dataSource.connectionConfig, query);
        break;
      case 'csv':
        rows = await new CsvDriver().execute(dataSource.connectionConfig, query);
        break;
      default:
        throw new BadRequestException(`Unsupported source type: ${String(dataSource.sourceType)}`);
    }

    if (query.aggregate) {
      rows = applyAggregation(rows, query.aggregate);
    }

    const query_ms = Date.now() - t0;
    this.logger.log(`Query on source ${sourceId} (${dataSource.sourceType}): ${rows.length} rows in ${query_ms}ms`);

    if (this.redis && cacheTtl > 0) {
      await this.redis.set(cacheKey, JSON.stringify(rows), 'EX', cacheTtl);
    }

    return { data: rows, meta: { cached: false, query_ms } };
  }

  async exportCsv(sourceId: string, query: QueryConfig): Promise<string> {
    const result = await this.execute(sourceId, query, 0);
    return rowsToCsv(result.data);
  }
}
