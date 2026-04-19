import { Inject, Injectable, Logger } from '@nestjs/common';
import { DB_SERVICE, IDbService } from '../db/db.interface';
import { WorkflowTransitionEvent } from '../events/event-types';

export interface Notification {
  id: string;
  userId: string | null;
  type: string;
  title: string;
  body: string | null;
  entityId: string | null;
  entityType: string | null;
  isRead: boolean;
  createdAt: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(@Inject(DB_SERVICE) private readonly db: IDbService) {}

  async onWorkflowTransition(event: WorkflowTransitionEvent): Promise<void> {
    const { pageId, from, to, actorId } = event;
    const title = `Page ${pageId} moved from ${from} to ${to}`;

    this.logger.log(`[notification] ${title} (actor=${actorId})`);

    try {
      await this.db.execute(
        `INSERT INTO NOTIFICATIONS (USER_ID, TYPE, TITLE, BODY, ENTITY_ID, ENTITY_TYPE)
         VALUES (HEXTORAW(REPLACE(:actorId, '-', '')), 'workflow.transition', :title, :body,
                 HEXTORAW(REPLACE(:pageId, '-', '')), 'page')`,
        { actorId, title, body: `Status: ${from} → ${to}`, pageId },
      );
    } catch (err) {
      this.logger.warn(`Failed to persist notification: ${String(err)}`);
    }

    this.dispatchWebhook({ event: 'workflow.transition', pageId, from, to, actorId });
  }

  async list(userId: string, limit = 20): Promise<Notification[]> {
    return this.db.query<Notification>(
      `SELECT LOWER(RAWTOHEX(ID)) AS "id",
              LOWER(RAWTOHEX(USER_ID)) AS "userId",
              TYPE AS "type",
              TITLE AS "title",
              BODY AS "body",
              LOWER(RAWTOHEX(ENTITY_ID)) AS "entityId",
              ENTITY_TYPE AS "entityType",
              IS_READ AS "isRead",
              CREATED_AT AS "createdAt"
       FROM   NOTIFICATIONS
       WHERE  USER_ID = HEXTORAW(REPLACE(:userId, '-', ''))
       ORDER  BY CREATED_AT DESC
       FETCH FIRST :limit ROWS ONLY`,
      { userId, limit },
    );
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.db.execute(
      `UPDATE NOTIFICATIONS SET IS_READ = 1
       WHERE  ID = HEXTORAW(REPLACE(:id, '-', ''))
         AND  USER_ID = HEXTORAW(REPLACE(:userId, '-', ''))`,
      { id, userId },
    );
  }

  private dispatchWebhook(payload: Record<string, unknown>): void {
    const url = process.env['WEBHOOK_URL'];
    if (!url) return;

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((err: unknown) => {
      this.logger.warn(`Webhook delivery failed to ${url}: ${String(err)}`);
    });
  }
}
