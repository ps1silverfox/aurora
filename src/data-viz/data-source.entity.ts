export type SourceType = 'oracle' | 'postgresql' | 'rest_api' | 'csv';

export interface DataSource {
  id: string;
  name: string;
  sourceType: SourceType;
  /** Decrypted connection config — never expose raw to API responses */
  connectionConfig: Record<string, unknown>;
  createdBy: string | null;
  createdAt: Date;
}

export interface DataSourceRow {
  ID: string;
  NAME: string;
  SOURCE_TYPE: string;
  CONNECTION_CONFIG: string;
  CREATED_BY: string | null;
  CREATED_AT: string;
}

export interface CreateDataSourceDto {
  name: string;
  sourceType: SourceType;
  connectionConfig: Record<string, unknown>;
}
