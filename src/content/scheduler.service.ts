import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ContentRepository } from './content.repository';
import { AuditService } from '../audit/audit.service';
import { EVENT_PUBLISHER, IEventPublisher } from '../events/event-publisher.interface';

@Injectable()
export class SchedulerService {
  constructor(
    private readonly repo: ContentRepository,
    private readonly audit: AuditService,
    @Inject(EVENT_PUBLISHER) private readonly events: IEventPublisher,
  ) {}

  @Cron('*/60 * * * * *')
  async publishScheduledPages(): Promise<void> {
    const { data: pages } = await this.repo.listPages(
      { status: 'approved' },
      null,
      100,
    );

    const now = new Date();
    const due = pages.filter((p) => p.scheduledAt != null && p.scheduledAt <= now);

    for (const page of due) {
      const publishedAt = new Date();
      await this.repo.updatePage(page.id, { status: 'published', publishedAt });

      this.events.publish('workflow.transition', {
        pageId: page.id,
        action: 'publish',
        fromStatus: 'approved',
        toStatus: 'published',
        actorId: null,
      });
      await this.audit.log({
        actorId: null,
        action: 'workflow.transition',
        entityType: 'page',
        entityId: page.id,
        diff: { fromStatus: 'approved', toStatus: 'published', scheduledAt: page.scheduledAt },
      });
    }
  }
}
