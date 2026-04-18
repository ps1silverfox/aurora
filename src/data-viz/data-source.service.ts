import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { DB_SERVICE, IDbService } from '../db/db.interface';
import {
  CreateDataSourceDto,
  DataSource,
  DataSourceRow,
  SourceType,
} from './data-source.entity';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function getEncryptionKey(): Buffer {
  const hex = process.env['DS_ENCRYPTION_KEY'] ?? '';
  if (hex.length !== 64) {
    throw new Error('DS_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');
  const [ivHex, tagHex, encHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

function rowToDataSource(row: DataSourceRow): DataSource {
  let connectionConfig: Record<string, unknown> = {};
  try {
    const decrypted = decrypt(row.CONNECTION_CONFIG);
    connectionConfig = JSON.parse(decrypted) as Record<string, unknown>;
  } catch {
    // Treat as unencrypted JSON for CSV test fixtures
    try {
      connectionConfig = JSON.parse(row.CONNECTION_CONFIG) as Record<string, unknown>;
    } catch {
      connectionConfig = {};
    }
  }
  return {
    id: row.ID,
    name: row.NAME,
    sourceType: row.SOURCE_TYPE as SourceType,
    connectionConfig,
    createdBy: row.CREATED_BY,
    createdAt: new Date(row.CREATED_AT),
  };
}

@Injectable()
export class DataSourceService {
  private readonly logger = new Logger(DataSourceService.name);

  constructor(@Inject(DB_SERVICE) private readonly db: IDbService) {}

  async register(dto: CreateDataSourceDto, createdBy?: string): Promise<string> {
    const encryptedConfig = encrypt(JSON.stringify(dto.connectionConfig));
    const id = crypto.randomUUID();
    await this.db.execute(
      `INSERT INTO DATA_SOURCES (ID, NAME, SOURCE_TYPE, CONNECTION_CONFIG, CREATED_BY)
       VALUES (HEXTORAW(REPLACE(:id, '-', '')), :name, :sourceType, :connectionConfig, HEXTORAW(REPLACE(:createdBy, '-', '')))`,
      {
        id,
        name: dto.name,
        sourceType: dto.sourceType,
        connectionConfig: encryptedConfig,
        createdBy: createdBy ?? null,
      },
    );
    this.logger.log(`Registered data source "${dto.name}" (${dto.sourceType})`);
    return id;
  }

  async list(): Promise<Omit<DataSource, 'connectionConfig'>[]> {
    const rows = await this.db.query<DataSourceRow>(
      `SELECT ID, NAME, SOURCE_TYPE, CONNECTION_CONFIG, CREATED_BY, CREATED_AT
       FROM DATA_SOURCES ORDER BY CREATED_AT DESC`,
    );
    return rows.map((row) => {
      const ds = rowToDataSource(row);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { connectionConfig: _omit, ...safe } = ds;
      return safe;
    });
  }

  async getById(id: string): Promise<DataSource> {
    const rows = await this.db.query<DataSourceRow>(
      `SELECT ID, NAME, SOURCE_TYPE, CONNECTION_CONFIG, CREATED_BY, CREATED_AT
       FROM DATA_SOURCES WHERE ID = HEXTORAW(REPLACE(:id, '-', ''))`,
      { id },
    );
    if (rows.length === 0) throw new NotFoundException(`DataSource ${id} not found`);
    return rowToDataSource(rows[0] as DataSourceRow);
  }

  async delete(id: string): Promise<void> {
    const rows = await this.db.query<DataSourceRow>(
      `SELECT ID FROM DATA_SOURCES WHERE ID = HEXTORAW(REPLACE(:id, '-', ''))`,
      { id },
    );
    if (rows.length === 0) throw new NotFoundException(`DataSource ${id} not found`);
    await this.db.execute(
      `DELETE FROM DATA_SOURCES WHERE ID = HEXTORAW(REPLACE(:id, '-', ''))`,
      { id },
    );
  }

  async testConnection(id: string): Promise<{ ok: boolean; message: string }> {
    const ds = await this.getById(id);
    try {
      switch (ds.sourceType) {
        case 'oracle':
          // In CSV mode the DB service itself is a stub; treat as reachable
          await this.db.query('SELECT 1 FROM DUAL');
          return { ok: true, message: 'Oracle connection successful' };

        case 'postgresql': {
          // Validate that host/port/database keys exist in config
          const cfg = ds.connectionConfig as { host?: unknown; port?: unknown; database?: unknown };
          if (!cfg.host || !cfg.port || !cfg.database) {
            throw new BadRequestException('PostgreSQL config requires host, port, database');
          }
          const host = typeof cfg.host === 'string' ? cfg.host : JSON.stringify(cfg.host);
          const port = typeof cfg.port === 'number' ? String(cfg.port) : JSON.stringify(cfg.port);
          const db = typeof cfg.database === 'string' ? cfg.database : JSON.stringify(cfg.database);
          return { ok: true, message: `PostgreSQL config valid (${host}:${port}/${db})` };
        }

        case 'rest_api': {
          const { url } = ds.connectionConfig as { url?: unknown };
          if (!url || typeof url !== 'string') {
            throw new BadRequestException('REST API config requires url');
          }
          const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
          return { ok: response.ok, message: `HTTP ${response.status}` };
        }

        case 'csv':
          return { ok: true, message: 'CSV source — no connection required' };

        default:
          return { ok: false, message: 'Unknown source type' };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Connection test failed for ${id}: ${message}`);
      return { ok: false, message };
    }
  }
}
