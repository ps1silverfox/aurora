export const DB_SERVICE = Symbol('IDbService');

export interface OutBindDescriptor {
  dir: 'out';
  type: 'string' | 'number';
}

export interface IDbService {
  query<T>(sql: string, binds?: Record<string, unknown> | unknown[]): Promise<T[]>;
  execute(sql: string, binds?: Record<string, unknown> | unknown[]): Promise<void>;
  /** Execute PL/SQL with OUT bind parameters; returns the out-bind values. */
  executeOut(
    sql: string,
    binds: Record<string, OutBindDescriptor | string | number | null>,
  ): Promise<Record<string, unknown>>;
  executeBatch(sql: string, binds: (Record<string, unknown> | unknown[])[]): Promise<void>;
}
