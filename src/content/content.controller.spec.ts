import { Test } from '@nestjs/testing';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { WorkflowService } from './workflow.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { RolesGuard } from '../users/roles.guard';
import { NotFoundError, ForbiddenError, ValidationError } from '../common/errors';
import { AuthenticatedUser } from '../auth/types';
import { Page } from './entities/page.entity';
import { Revision } from './entities/revision.entity';
import { CursorPage } from '../common/pagination';

const baseDate = new Date('2024-01-01T00:00:00Z');

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    title: 'Hello',
    slug: 'hello',
    status: 'draft',
    authorId: 'user-1',
    publishedAt: null,
    scheduledAt: null,
    viewCount: 0,
    createdAt: baseDate,
    updatedAt: baseDate,
    deletedAt: null,
    ...overrides,
  };
}

function makeRevision(overrides: Partial<Revision> = {}): Revision {
  return {
    id: 'rev-1',
    pageId: 'aaaaaaaa-0000-0000-0000-000000000001',
    title: 'Hello',
    blocks: [],
    createdBy: 'user-1',
    createdAt: baseDate,
    ...overrides,
  };
}

const editorUser: AuthenticatedUser = { id: 'user-1', email: 'ed@x.com', name: 'Ed', roles: ['editor'] };
const authorUser: AuthenticatedUser = { id: 'user-2', email: 'au@x.com', name: 'Au', roles: ['author'] };

function makeCursorPage<T>(data: T[]): CursorPage<T> {
  return { data, nextCursor: null, prevCursor: null };
}

describe('ContentController', () => {
  let controller: ContentController;
  let contentService: jest.Mocked<ContentService>;
  let workflowService: jest.Mocked<WorkflowService>;
  let knowledgeBase: jest.Mocked<KnowledgeBaseService>;

  beforeEach(async () => {
    contentService = {
      createPage: jest.fn(),
      getPage: jest.fn(),
      getPageBySlug: jest.fn(),
      updatePage: jest.fn(),
      deletePage: jest.fn(),
      listPages: jest.fn(),
      listRevisions: jest.fn(),
      getRevision: jest.fn() as jest.MockedFunction<(pageId: string, revId: string) => Promise<Revision | null>>,
      restoreRevision: jest.fn(),
    } as unknown as jest.Mocked<ContentService>;

    workflowService = {
      transition: jest.fn(),
    } as unknown as jest.Mocked<WorkflowService>;

    knowledgeBase = {
      viewPage: jest.fn().mockResolvedValue(undefined),
      ratePage: jest.fn().mockResolvedValue(undefined),
      getHelpfulPct: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<KnowledgeBaseService>;

    const module = await Test.createTestingModule({
      controllers: [ContentController],
      providers: [
        { provide: ContentService, useValue: contentService },
        { provide: WorkflowService, useValue: workflowService },
        { provide: KnowledgeBaseService, useValue: knowledgeBase },
        { provide: RolesGuard, useValue: { canActivate: () => true } },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ContentController);
  });

  describe('create', () => {
    it('creates page with actor id as default authorId', async () => {
      const page = makePage();
      contentService.createPage.mockResolvedValue(page);

      const result = await controller.create(
        { title: 'Hello', blocks: [] },
        editorUser,
      );
      expect(result).toBe(page);
      expect(contentService.createPage).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Hello', authorId: editorUser.id }),
        editorUser.id,
      );
    });
  });

  describe('list', () => {
    it('returns paginated pages', async () => {
      const cursorPage = makeCursorPage([makePage()]);
      contentService.listPages.mockResolvedValue(cursorPage);

      const result = await controller.list(undefined, '10', 'draft', undefined);
      expect(result).toBe(cursorPage);
      expect(contentService.listPages).toHaveBeenCalledWith(
        { status: 'draft' },
        null,
        10,
      );
    });

    it('throws ValidationError for invalid status', async () => {
      await expect(controller.list(undefined, undefined, 'invalid')).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError for out-of-range limit', async () => {
      await expect(controller.list(undefined, '200')).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('findOne', () => {
    it('returns page with helpfulPct when found', async () => {
      const page = makePage();
      contentService.getPage.mockResolvedValue(page);
      knowledgeBase.getHelpfulPct.mockResolvedValue(75);

      const result = await controller.findOne(page.id);
      expect(result).toMatchObject({ id: page.id, helpfulPct: 75 });
    });

    it('throws NotFoundError when page missing', async () => {
      contentService.getPage.mockResolvedValue(null);
      await expect(controller.findOne('missing')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('update', () => {
    it('allows editor to update any page', async () => {
      const page = makePage({ authorId: 'other-user' });
      contentService.getPage.mockResolvedValue(page);
      contentService.updatePage.mockResolvedValue(makePage({ title: 'Updated' }));

      const result = await controller.update(page.id, { title: 'Updated' }, editorUser);
      expect(result.title).toBe('Updated');
    });

    it('allows author to update own page', async () => {
      const page = makePage({ authorId: authorUser.id });
      contentService.getPage.mockResolvedValue(page);
      contentService.updatePage.mockResolvedValue(page);

      await expect(controller.update(page.id, { title: 'Mine' }, authorUser)).resolves.toBeDefined();
    });

    it('throws ForbiddenError when author tries to update another authors page', async () => {
      const page = makePage({ authorId: 'someone-else' });
      contentService.getPage.mockResolvedValue(page);

      await expect(controller.update(page.id, { title: 'Hijack' }, authorUser)).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe('remove', () => {
    it('soft-deletes page', async () => {
      const page = makePage();
      contentService.getPage.mockResolvedValue(page);
      contentService.deletePage.mockResolvedValue(undefined);

      await controller.remove(page.id, editorUser);
      expect(contentService.deletePage).toHaveBeenCalledWith(page.id, editorUser.id);
    });

    it('throws NotFoundError when page missing', async () => {
      contentService.getPage.mockResolvedValue(null);
      await expect(controller.remove('missing', editorUser)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('transition', () => {
    it('delegates to workflow service', async () => {
      const page = makePage({ status: 'review' });
      workflowService.transition.mockResolvedValue(page);

      const result = await controller.transition(page.id, { action: 'approve' }, editorUser);
      expect(result).toBe(page);
      expect(workflowService.transition).toHaveBeenCalledWith(page.id, 'approve', {
        id: editorUser.id,
        role: 'editor',
      });
    });

    it('throws NotFoundError when workflow returns null', async () => {
      workflowService.transition.mockResolvedValue(null);
      await expect(controller.transition('x', { action: 'submit' }, editorUser)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('listRevisions', () => {
    it('returns revisions for existing page', async () => {
      const page = makePage();
      contentService.getPage.mockResolvedValue(page);
      const cursorPage = makeCursorPage([makeRevision()]);
      contentService.listRevisions.mockResolvedValue(cursorPage);

      const result = await controller.listRevisions(page.id);
      expect(result).toBe(cursorPage);
    });

    it('throws NotFoundError for missing page', async () => {
      contentService.getPage.mockResolvedValue(null);
      await expect(controller.listRevisions('missing')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('recordView', () => {
    it('delegates to knowledgeBase.viewPage with ip from header', async () => {
      const req = { headers: { 'x-forwarded-for': '10.0.0.1' }, ip: '127.0.0.1' } as unknown as import('express').Request;
      await controller.recordView('page-1', req);
      expect(knowledgeBase.viewPage).toHaveBeenCalledWith('page-1', '10.0.0.1');
    });
  });

  describe('ratePage', () => {
    it('delegates to knowledgeBase.ratePage', async () => {
      await controller.ratePage('page-1', { helpful: true });
      expect(knowledgeBase.ratePage).toHaveBeenCalledWith('page-1', true);
    });
  });

  describe('restoreRevision', () => {
    it('restores revision and returns updated page', async () => {
      const page = makePage();
      contentService.restoreRevision.mockResolvedValue(page);

      const result = await controller.restoreRevision(page.id, 'rev-1', editorUser);
      expect(result).toBe(page);
      expect(contentService.restoreRevision).toHaveBeenCalledWith(page.id, 'rev-1', editorUser.id);
    });

    it('throws NotFoundError when restore returns null', async () => {
      contentService.restoreRevision.mockResolvedValue(null);
      await expect(controller.restoreRevision('x', 'y', editorUser)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
