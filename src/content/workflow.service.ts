import { Inject, Injectable } from '@nestjs/common';
import { ContentRepository } from './content.repository';
import { AuditService } from '../audit/audit.service';
import { EVENT_PUBLISHER, IEventPublisher } from '../events/event-publisher.interface';
import { Page, PageStatus } from './entities/page.entity';
import { ForbiddenError } from '../common/errors';

export interface Actor {
  id: string;
  role: string;
}

type WorkflowAction = 'submit' | 'approve' | 'publish' | 'archive';

interface Transition {
  from: PageStatus;
  to: PageStatus;
  allowedRoles: string[];
  setPublishedAt?: boolean;
}

const TRANSITIONS: Record<WorkflowAction, Transition> = {
  submit:  { from: 'draft',    to: 'review',    allowedRoles: ['author', 'editor', 'admin'] },
  approve: { from: 'review',   to: 'approved',  allowedRoles: ['editor', 'admin'] },
  publish: { from: 'approved', to: 'published', allowedRoles: ['editor', 'admin'], setPublishedAt: true },
  archive: { from: 'published', to: 'archived', allowedRoles: ['admin'] },
};

@Injectable()
export class WorkflowService {
  constructor(
    private readonly repo: ContentRepository,
    private readonly audit: AuditService,
    @Inject(EVENT_PUBLISHER) private readonly events: IEventPublisher,
  ) {}

  async transition(
    pageId: string,
    action: WorkflowAction,
    actor: Actor,
  ): Promise<Page | null> {
    const page = await this.repo.findById(pageId);
    if (page == null) return null;

    const def = TRANSITIONS[action];
    if (page.status !== def.from) {
      throw new Error(`Cannot perform '${action}' on a page with status '${page.status}'`);
    }
    if (!def.allowedRoles.includes(actor.role)) {
      throw new ForbiddenError(`Role '${actor.role}' cannot perform action '${action}'`);
    }

    const updateData: Partial<Pick<Page, 'status' | 'publishedAt'>> = { status: def.to };
    if (def.setPublishedAt) {
      updateData.publishedAt = new Date();
    }

    const updated = await this.repo.updatePage(pageId, updateData);

    this.events.publish('workflow.transition', {
      pageId,
      action,
      fromStatus: def.from,
      toStatus: def.to,
      actorId: actor.id,
    });
    await this.audit.log({
      actorId: actor.id,
      action: 'workflow.transition',
      entityType: 'page',
      entityId: pageId,
      diff: { action, fromStatus: def.from, toStatus: def.to },
    });
    return updated;
  }
}
