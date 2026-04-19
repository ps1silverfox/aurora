import Papa from 'papaparse';
import { IQueryDriver, QueryConfig, Row } from './driver.interface';

interface CsvConfig {
  /** Raw CSV string, or pre-parsed Row array for testing */
  data: string | Row[];
  delimiter?: string;
  header?: boolean;
}

export class CsvDriver implements IQueryDriver {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute(connectionConfig: Record<string, unknown>, _query: QueryConfig): Promise<Row[]> {
    const cfg = connectionConfig as unknown as CsvConfig;

    if (Array.isArray(cfg.data)) {
      return Promise.resolve(cfg.data as Row[]);
    }

    const result = Papa.parse<Row>(cfg.data, {
      header: cfg.header ?? true,
      delimiter: cfg.delimiter ?? ',',
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    if (result.errors.length > 0) {
      const first = result.errors[0];
      throw new Error(`CSV parse error: ${first?.message ?? 'unknown'}`);
    }
    return Promise.resolve(result.data);
  }
}
