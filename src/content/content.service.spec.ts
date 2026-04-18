import { Test } from '@nestjs/testing';
import { ContentService, CreatePageDto, UpdatePageDto } from './content.service';
import { ContentRepository } from './content.repository';
import { AuditService } from '../audit/audit.service';
import { EVENT_PUBLISHER, IEventPublisher } from '../events/event-publisher.interface';
import { Page } from './entities/page.entity';

const baseDate = new Date('2024-01-01T00:00:00Z');

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    title: 'Hello World',
    slug: 'hello-world',
    status: 'draft',
    authorId: 'bbbbbbbb-0000-0000-0000-000000000001',
    publishedAt: null,
    scheduledAt: null,
    viewCount: 0,
    createdAt: baseDate,
    updatedAt: baseDate,
    deletedAt: null,
    ...overrides,
  };
}

describe('ContentService', () => {
  let service: ContentService;
  let repo: jest.Mocked<ContentRepository>;
  let audit: jest.Mocked<AuditService>;
  let events: jest.Mocked<IEventPublisher>;

  beforeEach(async () => {
    repo = {
      createPage: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      updatePage: jest.fn(),
      softDeletePage: jest.fn(),
      listPages: jest.fn(),
      upsertBlocks: jest.fn(),
      createRevision: jest.fn(),
      listRevisions: jest.fn(),
      findRevision: jest.fn(),
      restoreRevision: jest.fn(),
      findBlocksByPageId: jest.fn(),
    } as unknown as jest.Mocked<ContentRepository>;

    audit = { log: jest.fn() } as unknown as jest.Mocked<AuditService>;
    events = { publish: jest.fn() } as jest.Mocked<IEventPublisher>;

    const module = await Test.createTestingModule({
      providers: [
        ContentService,
        { provide: ContentRepository, useValue: repo },
        { provide: AuditService, useValue: audit },
        { provide: EVENT_PUBLISHER, useValue: events },
      ],
    }).compile();

    service = module.get(ContentService);
  });

  describe('createPage', () => {
    it('inserts page and returns it', async () => {
      const page = makePage();
      repo.createPage.mockResolvedValue(page);
      repo.findBlocksByPageId.mockResolvedValue([]);
      audit.log.mockResolvedValue(undefined);

      const dto: CreatePageDto = { title: 'Hello World', authorId: page.authorId ?? undefined };
      const result = await service.createPage(dto, 'actor-uuid');

      expect(repo.createPage).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Hello World', slug: 'hello-world' }),
      );
      expect(result.id).toBe(page.id);
    });

    it('auto-generates slug from title', async () => {
      const page = makePage({ title: 'My   New Page!', slug: 'my-new-page' });
      repo.createPage.mockResolvedValue(page);
      repo.findBlocksByPageId.mockResolvedValue([]);
      audit.log.mockResolvedValue(undefined);

      await service.createPage({ title: 'My   New Page!' }, 'actor');

      const call = repo.createPage.mock.calls[0]?.[0];
      expect(call?.slug).toBe('my-new-page');
    });

    it('uses provided slug when given', async () => {
      const page = makePage({ slug: 'custom-slug' });
      repo.createPage.mockResolvedValue(page);
      repo.findBlocksByPageId.mockResolvedValue([]);
      audit.log.mockResolvedValue(undefined);

      await service.createPage({ title: 'Anything', slug: 'custom-slug' }, 'actor');

      expect(repo.createPage.mock.calls[0]?.[0]?.slug).toBe('custom-slug');
    });

    it('emits content.created event', async () => {
      const page = makePage();
      repo.createPage.mockResolvedValue(page);
      repo.findBlocksByPageId.mockResolvedValue([]);
      audit.log.mockResolvedValue(undefined);

      await service.createPage({ title: 'Hello World' }, 'actor');

      expect(events.publish).toHaveBeenCalledWith('content.created', expect.objectContaining({ id: page.id }));
    });

    it('logs audit entry', async () => {
      const page = makePage();
      repo.createPage.mockResolvedValue(page);
      repo.findBlocksByPageId.mockResolvedValue([]);
      audit.log.mockResolvedValue(undefined);

      await service.createPage({ title: 'Hello World' }, 'actor-uuid');

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'content.create', actorId: 'actor-uuid', entityType: 'page' }),
      );
    });
  });

  describe('updatePage', () => {
    it('creates revision before updating', async () => {
      const page = makePage();
      repo.findById.mockResolvedValue(page);
      repo.findBlocksByPageId.mockResolvedValue([]);
      repo.createRevision.mockResolvedValue({ id: 'r1', pageId: page.id, title: page.title, blocks: [], createdBy: null, createdAt: baseDate });
      repo.updatePage.mockResolvedValue(page);
      audit.log.mockResolvedValue(undefined);

      const dto: UpdatePageDto = { title: 'New Title' };
      await service.updatePage(page.id, dto, 'actor');

      expect(repo.createRevision).toHaveBeenCalledWith(
        expect.objectContaining({ pageId: page.id, title: page.title }),
      );
      expect(repo.updatePage).toHaveBeenCalled();
    });

    it('returns null when page not found', async () => {
      repo.findById.mockResolvedValue(null);
      const result = await service.updatePage('nonexistent', { title: 'X' }, 'actor');
      expect(result).toBeNull();
    });

    it('emits content.updated event', async () => {
      const page = makePage();
      repo.findById.mockResolvedValue(page);
      repo.findBlocksByPageId.mockResolvedValue([]);
      repo.createRevision.mockResolvedValue({ id: 'r1', pageId: page.id, title: page.title, blocks: [], createdBy: null, createdAt: baseDate });
      repo.updatePage.mockResolvedValue(page);
      audit.log.mockResolvedValue(undefined);

      await service.updatePage(page.id, { title: 'New Title' }, 'actor');

      expect(events.publish).toHaveBeenCalledWith('content.updated', expect.objectContaining({ id: page.id }));
    });

    it('audits the update', async () => {
      const page = makePage();
      repo.findById.mockResolvedValue(page);
      repo.findBlocksByPageId.mockResolvedValue([]);
      repo.createRevision.mockResolvedValue({ id: 'r1', pageId: page.id, title: page.title, blocks: [], createdBy: null, createdAt: baseDate });
      repo.updatePage.mockResolvedValue(page);
      audit.log.mockResolvedValue(undefined);

      await service.updatePage(page.id, { title: 'New Title' }, 'actor-uuid');

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'content.update', actorId: 'actor-uuid', entityId: page.id }),
      );
    });
  });

  describe('deletePage', () => {
    it('soft deletes and emits content.deleted', async () => {
      const page = makePage();
      repo.findById.mockResolvedValue(page);
      repo.softDeletePage.mockResolvedValue(undefined);
      audit.log.mockResolvedValue(undefined);

      await service.deletePage(page.id, 'actor');

      expect(repo.softDeletePage).toHaveBeenCalledWith(page.id);
      expect(events.publish).toHaveBeenCalledWith('content.deleted', expect.objectContaining({ id: page.id }));
    });

    it('does nothing when page not found', async () => {
      repo.findById.mockResolvedValue(null);
      await service.deletePage('missing', 'actor');
      expect(repo.softDeletePage).not.toHaveBeenCalled();
    });

    it('audits the delete', async () => {
      const page = makePage();
      repo.findById.mockResolvedValue(page);
      repo.softDeletePage.mockResolvedValue(undefined);
      audit.log.mockResolvedValue(undefined);

      await service.deletePage(page.id, 'actor-uuid');

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'content.delete', actorId: 'actor-uuid', entityId: page.id }),
      );
    });
  });

  describe('getPage / getPageBySlug / listPages', () => {
    it('getPage delegates to repository', async () => {
      const page = makePage();
      repo.findById.mockResolvedValue(page);
      const result = await service.getPage(page.id);
      expect(result).toBe(page);
    });

    it('getPageBySlug delegates to repository', async () => {
      const page = makePage();
      repo.findBySlug.mockResolvedValue(page);
      const result = await service.getPageBySlug('hello-world');
      expect(result).toBe(page);
    });

    it('listPages delegates to repository', async () => {
      const cursor = { data: [], nextCursor: null, prevCursor: null };
      repo.listPages.mockResolvedValue(cursor);
      const result = await service.listPages({}, null, 20);
      expect(result).toBe(cursor);
    });
  });
});
