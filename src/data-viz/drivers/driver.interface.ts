export type Row = Record<string, unknown>;

export interface QueryConfig {
  sql?: string;
  /** For REST/CSV sources: JSONPath expression to extract array */
  jsonPath?: string;
  /** Server-side aggregation spec */
  aggregate?: AggregateSpec;
  /** Pagination */
  page?: number;
  pageSize?: number;
}

export interface AggregateSpec {
  groupBy: string[];
  functions: Array<{
    fn: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
    column: string;
    alias: string;
  }>;
}

export interface QueryResult {
  data: Row[];
  meta: {
    cached: boolean;
    query_ms: number;
    total?: number;
  };
}

export interface IQueryDriver {
  execute(connectionConfig: Record<string, unknown>, query: QueryConfig): Promise<Row[]>;
}
