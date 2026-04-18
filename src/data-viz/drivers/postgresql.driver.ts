import { Client } from 'pg';
import { IQueryDriver, QueryConfig, Row } from './driver.interface';

interface PgConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

const MAX_ROWS = 10_000;
const DEFAULT_PAGE_SIZE = 100;
const CONNECT_TIMEOUT_MS = 5_000;

export class PostgresqlDriver implements IQueryDriver {
  async execute(connectionConfig: Record<string, unknown>, query: QueryConfig): Promise<Row[]> {
    const cfg = connectionConfig as unknown as PgConfig;
    const sql = query.sql?.trim() ?? '';
    if (!sql.toUpperCase().startsWith('SELECT')) {
      throw new Error('PostgreSQL driver only allows SELECT queries');
    }

    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_ROWS);
    const offset = ((query.page ?? 1) - 1) * pageSize;

    const client = new Client({
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      ssl: cfg.ssl ?? false,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
      // Read-only: set default_transaction_read_only at session level
    });

    await client.connect();
    try {
      await client.query('SET default_transaction_read_only = on');
      const result = await client.query(`${sql} LIMIT $1 OFFSET $2`, [pageSize, offset]);
      return result.rows as Row[];
    } finally {
      await client.end();
    }
  }
}
