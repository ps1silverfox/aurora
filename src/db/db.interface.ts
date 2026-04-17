export const DB_SERVICE = Symbol('IDbService');

export interface IDbService {
  query<T>(sql: string, binds?: Record<string, unknown> | unknown[]): Promise<T[]>;
  execute(sql: string, binds?: Record<string, unknown> | unknown[]): Promise<void>;
  executeBatch(sql: string, binds: (Record<string, unknown> | unknown[])[]): Promise<void>;
}
