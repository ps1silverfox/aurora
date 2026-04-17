import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DB_SERVICE, IDbService } from '../db/db.interface';
import { RolesGuard } from '../users/roles.guard';
import { Roles } from '../users/roles.decorator';
import { encodeCursor, decodeCursor, CursorPage } from '../common/pagination';
import { ValidationError } from '../common/errors';

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  diff: Record<string, unknown> | null;
  prevHash: string | null;
  hash: string;
  createdAt: Date;
}

interface AuditRow {
  ID: string;
  ACTOR_ID: string | null;
  ACTION: string;
  ENTITY_TYPE: string | null;
  ENTITY_ID: string | null;
  DIFF: string | null;
  PREV_HASH: string | null;
  HASH: string;
  CREATED_AT: Date;
}

function mapEntry(row: AuditRow): AuditLogEntry {
  return {
    id: row.ID.replace(/-/g, '').toLowerCase(),
    actorId: row.ACTOR_ID ? row.ACTOR_ID.replace(/-/g, '').toLowerCase() : null,
    action: row.ACTION,
    entityType: row.ENTITY_TYPE ?? null,
    entityId: row.ENTITY_ID ?? null,
    diff: row.DIFF != null ? (JSON.parse(row.DIFF) as Record<string, unknown>) : null,
    prevHash: row.PREV_HASH ?? null,
    hash: row.HASH,
    createdAt: row.CREATED_AT,
  };
}

@Controller('api/v1/audit-log')
@UseGuards(RolesGuard)
export class AuditController {
  constructor(@Inject(DB_SERVICE) private readonly db: IDbService) {}

  @Get()
  @Roles('admin.audit.read')
  async list(
    @Query('entity_type') entityType?: string,
    @Query('actor_id') actorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<CursorPage<AuditLogEntry>> {
    const pageSize = limit != null ? parseInt(limit, 10) : 20;
    if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new ValidationError('limit must be between 1 and 100');
    }

    const conditions: string[] = [];
    const binds: Record<string, unknown> = { pageSize: pageSize + 1 };

    if (entityType) {
      conditions.push('ENTITY_TYPE = :entityType');
      binds['entityType'] = entityType;
    }
    if (actorId) {
      conditions.push('ACTOR_ID = HEXTORAW(:actorId)');
      binds['actorId'] = actorId.replace(/-/g, '').toUpperCase();
    }
    if (from) {
      if (isNaN(Date.parse(from))) throw new ValidationError('from must be a valid ISO date');
      conditions.push('CREATED_AT >= :fromDate');
      binds['fromDate'] = new Date(from);
    }
    if (to) {
      if (isNaN(Date.parse(to))) throw new ValidationError('to must be a valid ISO date');
      conditions.push('CREATED_AT <= :toDate');
      binds['toDate'] = new Date(to);
    }

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded != null && decoded['createdAt'] != null && decoded['id'] != null) {
        conditions.push(
          `(CREATED_AT > TIMESTAMP :afterTs OR (CREATED_AT = TIMESTAMP :afterTs AND RAWTOHEX(ID) > :afterId))`,
        );
        binds['afterTs'] = decoded['createdAt'];
        binds['afterId'] = (decoded['id'] as string).toUpperCase();
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await this.db.query<AuditRow>(
      `SELECT ID, ACTOR_ID, ACTION, ENTITY_TYPE, ENTITY_ID, DIFF, PREV_HASH, HASH, CREATED_AT
       FROM AUDIT_LOG
       ${where}
       ORDER BY CREATED_AT ASC, ID ASC
       FETCH FIRST :pageSize ROWS ONLY`,
      binds,
    );

    const hasNext = rows.length > pageSize;
    const data = rows.slice(0, pageSize).map(mapEntry);
    const last = data[data.length - 1];
    const nextCursor =
      hasNext && last != null
        ? encodeCursor({ createdAt: last.createdAt, id: last.id.toUpperCase() })
        : null;

    return { data, nextCursor, prevCursor: null };
  }
}
