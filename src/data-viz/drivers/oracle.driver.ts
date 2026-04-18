import { IDbService } from '../../db/db.interface';
import { IQueryDriver, QueryConfig, Row } from './driver.interface';

const MAX_ROWS = 10_000;
const DEFAULT_PAGE_SIZE = 100;

export class OracleDriver implements IQueryDriver {
  constructor(private readonly db: IDbService) {}

  async execute(_connectionConfig: Record<string, unknown>, query: QueryConfig): Promise<Row[]> {
    const sql = query.sql?.trim() ?? '';
    if (!sql.toUpperCase().startsWith('SELECT')) {
      throw new Error('Oracle driver only allows SELECT queries');
    }

    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_ROWS);
    const offset = ((query.page ?? 1) - 1) * pageSize;

    // Wrap user query in ROW_NUMBER() pagination
    const paginated = `
      SELECT * FROM (
        SELECT q.*, ROW_NUMBER() OVER (ORDER BY ROWNUM) AS RN__
        FROM (${sql}) q
      )
      WHERE RN__ > :offset AND RN__ <= :limit
    `;
    const rows = await this.db.query<Row>(paginated, { offset, limit: offset + pageSize });
    return rows.map((r) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { RN__: _rn, ...rest } = r as Record<string, unknown>;
      return rest;
    });
  }
}
