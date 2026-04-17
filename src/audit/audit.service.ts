import { Inject, Injectable } from '@nestjs/common';
import { DB_SERVICE, IDbService } from '../db/db.interface';

export interface AuditEntryInput {
  actorId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  diff?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DB_SERVICE) private readonly db: IDbService) {}

  async log(entry: AuditEntryInput): Promise<void> {
    const actorIdHex = entry.actorId ? entry.actorId.replace(/-/g, '') : null;
    const diffJson = entry.diff !== undefined ? JSON.stringify(entry.diff) : null;

    await this.db.execute(
      `BEGIN audit_pkg.INSERT_ENTRY(
        p_actor_id    => HEXTORAW(:actorId),
        p_action      => :action,
        p_entity_type => :entityType,
        p_entity_id   => :entityId,
        p_diff        => :diff
      ); END;`,
      {
        actorId: actorIdHex,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        diff: diffJson,
      },
    );
  }
}
