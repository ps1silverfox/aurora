import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import oracledb from 'oracledb';
import { IDbService } from './db.interface';

// TODO: set initOracleClient path for Thick mode (required for Oracle AQ / Advanced Security):
//   oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_21_x' })

@Injectable()
export class OracleDriver implements IDbService, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OracleDriver.name);
  private pool!: oracledb.Pool;

  async onModuleInit(): Promise<void> {
    this.pool = await oracledb.createPool({
      connectString: process.env['ORACLE_DSN'] ?? 'localhost:1521/ORCLPDB1',
      user: process.env['ORACLE_USER'],
      password: process.env['ORACLE_PASSWORD'],
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 2,
    });
    this.logger.log('Oracle connection pool created');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.close(0);
  }

  async query<T>(sql: string, binds?: Record<string, unknown> | unknown[]): Promise<T[]> {
    const conn = await this.pool.getConnection();
    try {
      const result = await conn.execute<T>(
        sql,
        (binds ?? {}) as oracledb.BindParameters,
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      return result.rows ?? [];
    } finally {
      await conn.close();
    }
  }

  async execute(sql: string, binds?: Record<string, unknown> | unknown[]): Promise<void> {
    const conn = await this.pool.getConnection();
    try {
      await conn.execute(
        sql,
        (binds ?? {}) as oracledb.BindParameters,
        { autoCommit: true },
      );
    } finally {
      await conn.close();
    }
  }

  async executeBatch(
    sql: string,
    binds: (Record<string, unknown> | unknown[])[],
  ): Promise<void> {
    const conn = await this.pool.getConnection();
    try {
      await conn.executeMany(
        sql,
        binds as oracledb.BindParameters[],
        { autoCommit: true },
      );
    } finally {
      await conn.close();
    }
  }
}
