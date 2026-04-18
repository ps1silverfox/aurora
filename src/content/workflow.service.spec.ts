import { Test } from '@nestjs/testing';
import { WorkflowService } from './workflow.service';
import { ContentRepository } from './content.repository';
import { AuditService } from '../audit/audit.service';
import { EVENT_PUBLISHER, IEventPublisher } from '../events/event-publisher.interface';
import { Page } from './entities/page.entity';
import { ForbiddenError } from '../common/errors';

const baseDate = new Date('2024-01-01T00:00:00Z');

function makePage(status: Page['status'], authorId = 'author-uuid'): Page {
  return {
    id: 'page-uuid',
    title: 'Test',
    slug: 'test',
    status,
    authorId,
    publishedAt: null,
    scheduledAt: null,
    viewCount: 0,
    createdAt: baseDate,
    updatedAt: baseDate,
    deletedAt: null,
  };
}

describe('WorkflowService', () => {
  let service: WorkflowService;
  let repo: jest.Mocked<ContentRepository>;
  let audit: jest.Mocked<AuditService>;
  let events: jest.Mocked<IEventPublisher>;

  beforeEach(async () => {
    repo = {
      findById: jest.fn(),
      updatePage: jest.fn(),
    } as unknown as jest.Mocked<ContentRepository>;

    audit = { log: jest.fn() } as unknown as jest.Mocked<AuditService>;
    events = { publish: jest.fn() } as jest.Mocked<IEventPublisher>;

    const module = await Test.createTestingModule({
      providers: [
        WorkflowService,
        { provide: ContentRepository, useValue: repo },
        { provide: AuditService, useValue: audit },
        { provide: EVENT_PUBLISHER, useValue: events },
      ],
    }).compile();

    service = module.get(WorkflowService);
  });

  describe('valid transitions', () => {
    it('author can submit draft → review', async () => {
      const page = makePage('draft');
      repo.findById.mockResolvedValue(page);
      repo.updatePage.mockResolvedValue({ ...page, status: 'review' });
      audit.log.mockResolvedValue(undefined);

      const result = await service.transition(page.id, 'submit', { id: 'author-uuid', role: 'author' });

      expect(repo.updatePage).toHaveBeenCalledWith(page.id, { status: 'review' });
      expect(result?.status).toBe('review');
    });

    it('editor can approve review → approved', async () => {
      const page = makePage('review');
      repo.findById.mockResolvedValue(page);
      repo.updatePage.mockResolvedValue({ ...page, status: 'approved' });
      audit.log.mockResolvedValue(undefined);

      const result = await service.transition(page.id, 'approve', { id: 'ed-uuid', role: 'editor' });

      expect(repo.updatePage).toHaveBeenCalledWith(page.id, { status: 'approved' });
      expect(result?.status).toBe('approved');
    });

    it('editor can publish approved → published', async () => {
      const page = makePage('approved');
      repo.findById.mockResolvedValue(page);
      repo.updatePage.mockResolvedValue({ ...page, status: 'published', publishedAt: new Date() });
      audit.log.mockResolvedValue(undefined);

      const result = await service.transition(page.id, 'publish', { id: 'ed-uuid', role: 'editor' });

      expect(repo.updatePage).toHaveBeenCalledWith(
        page.id,
        expect.objectContaining({ status: 'published', publishedAt: expect.any(Date) }),
      );
      expect(result?.status).toBe('published');
    });

    it('admin can publish approved → published', async () => {
      const page = makePage('approved');
      repo.findById.mockResolvedValue(page);
      repo.updatePage.mockResolvedValue({ ...page, status: 'published', publishedAt: new Date() });
      audit.log.mockResolvedValue(undefined);

      await service.transition(page.id, 'publish', { id: 'admin-uuid', role: 'admin' });

      expect(repo.updatePage).toHaveBeenCalled();
    });

    it('admin can archive published → archived', async () => {
      const page = makePage('published');
      repo.findById.mockResolvedValue(page);
      repo.updatePage.mockResolvedValue({ ...page, status: 'archived' });
      audit.log.mockResolvedValue(undefined);

      await service.transition(page.id, 'archive', { id: 'admin-uuid', role: 'admin' });

      expect(repo.updatePage).toHaveBeenCalledWith(page.id, { status: 'archived' });
    });
  });

  describe('invalid transitions', () => {
    it('throws ForbiddenError when author tries to approve', async () => {
      const page = makePage('review');
      repo.findById.mockResolvedValue(page);

      await expect(
        service.transition(page.id, 'approve', { id: 'author-uuid', role: 'author' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('throws ForbiddenError when author tries to publish', async () => {
      const page = makePage('approved');
      repo.findById.mockResolvedValue(page);

      await expect(
        service.transition(page.id, 'publish', { id: 'author-uuid', role: 'author' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('throws error for invalid status transition (draft → publish)', async () => {
      const page = makePage('draft');
      repo.findById.mockResolvedValue(page);

      await expect(
        service.transition(page.id, 'publish', { id: 'admin-uuid', role: 'admin' }),
      ).rejects.toThrow();
    });

    it('returns null when page not found', async () => {
      repo.findById.mockResolvedValue(null);
      const result = await service.transition('missing', 'submit', { id: 'actor', role: 'author' });
      expect(result).toBeNull();
    });
  });

  describe('events and audit', () => {
    it('emits workflow.transition event on success', async () => {
      const page = makePage('draft');
      repo.findById.mockResolvedValue(page);
      repo.updatePage.mockResolvedValue({ ...page, status: 'review' });
      audit.log.mockResolvedValue(undefined);

      await service.transition(page.id, 'submit', { id: 'author-uuid', role: 'author' });

      expect(events.publish).toHaveBeenCalledWith('workflow.transition', expect.objectContaining({
        pageId: page.id,
        action: 'submit',
        fromStatus: 'draft',
        toStatus: 'review',
      }));
    });

    it('audits the transition', async () => {
      const page = makePage('draft');
      repo.findById.mockResolvedValue(page);
      repo.updatePage.mockResolvedValue({ ...page, status: 'review' });
      audit.log.mockResolvedValue(undefined);

      await service.transition(page.id, 'submit', { id: 'author-uuid', role: 'author' });

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'workflow.transition', actorId: 'author-uuid', entityId: page.id }),
      );
    });
  });
});
