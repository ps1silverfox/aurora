import { Test } from '@nestjs/testing';
import { SchedulerService } from './scheduler.service';
import { ContentRepository } from './content.repository';
import { AuditService } from '../audit/audit.service';
import { EVENT_PUBLISHER, IEventPublisher } from '../events/event-publisher.interface';
import { Page } from './entities/page.entity';

const baseDate = new Date('2024-01-01T00:00:00Z');

function makeApprovedPage(scheduledAt: Date): Page {
  return {
    id: 'page-uuid',
    title: 'Scheduled',
    slug: 'scheduled',
    status: 'approved',
    authorId: null,
    publishedAt: null,
    scheduledAt,
    viewCount: 0,
    createdAt: baseDate,
    updatedAt: baseDate,
    deletedAt: null,
  };
}

describe('SchedulerService', () => {
  let service: SchedulerService;
  let repo: jest.Mocked<ContentRepository>;
  let audit: jest.Mocked<AuditService>;
  let events: jest.Mocked<IEventPublisher>;

  beforeEach(async () => {
    repo = {
      listPages: jest.fn(),
      updatePage: jest.fn(),
    } as unknown as jest.Mocked<ContentRepository>;

    audit = { log: jest.fn() } as unknown as jest.Mocked<AuditService>;
    events = { publish: jest.fn() } as jest.Mocked<IEventPublisher>;

    const module = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: ContentRepository, useValue: repo },
        { provide: AuditService, useValue: audit },
        { provide: EVENT_PUBLISHER, useValue: events },
      ],
    }).compile();

    service = module.get(SchedulerService);
  });

  it('publishes pages where scheduledAt <= now and status is approved', async () => {
    const pastDate = new Date(Date.now() - 1000);
    const page = makeApprovedPage(pastDate);
    repo.listPages.mockResolvedValue({ data: [page], nextCursor: null, prevCursor: null });
    repo.updatePage.mockResolvedValue({ ...page, status: 'published', publishedAt: new Date() });
    audit.log.mockResolvedValue(undefined);

    await service.publishScheduledPages();

    expect(repo.updatePage).toHaveBeenCalledWith(
      page.id,
      expect.objectContaining({ status: 'published', publishedAt: expect.any(Date) }),
    );
  });

  it('does not publish pages where scheduledAt is in the future', async () => {
    // listPages returns empty — scheduler filters in query
    repo.listPages.mockResolvedValue({ data: [], nextCursor: null, prevCursor: null });

    await service.publishScheduledPages();

    expect(repo.updatePage).not.toHaveBeenCalled();
  });

  it('emits workflow.transition for each page published', async () => {
    const pastDate = new Date(Date.now() - 1000);
    const page = makeApprovedPage(pastDate);
    repo.listPages.mockResolvedValue({ data: [page], nextCursor: null, prevCursor: null });
    repo.updatePage.mockResolvedValue({ ...page, status: 'published', publishedAt: new Date() });
    audit.log.mockResolvedValue(undefined);

    await service.publishScheduledPages();

    expect(events.publish).toHaveBeenCalledWith(
      'workflow.transition',
      expect.objectContaining({ pageId: page.id, toStatus: 'published' }),
    );
  });

  it('audits each scheduled publish', async () => {
    const pastDate = new Date(Date.now() - 1000);
    const page = makeApprovedPage(pastDate);
    repo.listPages.mockResolvedValue({ data: [page], nextCursor: null, prevCursor: null });
    repo.updatePage.mockResolvedValue({ ...page, status: 'published', publishedAt: new Date() });
    audit.log.mockResolvedValue(undefined);

    await service.publishScheduledPages();

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'workflow.transition', entityId: page.id }),
    );
  });

  it('handles empty scheduled pages list gracefully', async () => {
    repo.listPages.mockResolvedValue({ data: [], nextCursor: null, prevCursor: null });
    await expect(service.publishScheduledPages()).resolves.not.toThrow();
    expect(repo.updatePage).not.toHaveBeenCalled();
  });
});
