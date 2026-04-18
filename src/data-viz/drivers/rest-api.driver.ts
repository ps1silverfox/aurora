import { JSONPath } from 'jsonpath-plus';
import { IQueryDriver, QueryConfig, Row } from './driver.interface';

interface RestApiConfig {
  url: string;
  headers?: Record<string, string>;
  jsonPath?: string;
}

const FETCH_TIMEOUT_MS = 10_000;

export class RestApiDriver implements IQueryDriver {
  async execute(connectionConfig: Record<string, unknown>, query: QueryConfig): Promise<Row[]> {
    const cfg = connectionConfig as unknown as RestApiConfig;
    const response = await fetch(cfg.url, {
      headers: cfg.headers ?? {},
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`REST API returned HTTP ${response.status}`);
    }

    const json = (await response.json()) as object;
    const path = query.jsonPath ?? cfg.jsonPath ?? '$.*';
    const extracted = JSONPath<unknown[]>({ path, json, resultType: 'value' });
    return extracted.map((item) =>
      typeof item === 'object' && item !== null ? (item as Row) : { value: item },
    );
  }
}
