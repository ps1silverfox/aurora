import { Test } from '@nestjs/testing';
import { ContentRepository, CreateRevisionData } from './content.repository';
import { DB_SERVICE } from '../db/db.interface';

const mockDb = {
  query: jest.fn(),
  execute: jest.fn(),
  executeBatch: jest.fn(),
  executeOut: jest.fn().mockResolvedValue({}),
};

const RAW_ID = 'AABBCCDD11223344AABBCCDD11223344';
const UUID_ID = 'aabbccdd-1122-3344-aabb-ccdd11223344';
const AUTHOR_RAW = 'BBCCDDEE22334455BBCCDDEE22334455';
const AUTHOR_UUID = 'bbccddee-2233-4455-bbcc-ddee22334455';
const REV_RAW = 'CCDDEE1122334455CCDDEE1122334455';
const REV_UUID = 'ccddee11-2233-4455-ccdd-ee1122334455';

const pageRow = {
  ID: RAW_ID,
  TITLE: 'Hello World',
  SLUG: 'hello-world',
  STATUS: 'draft',
  AUTHOR_ID: AUTHOR_RAW,
  PUBLISHED_AT: null,
  SCHEDULED_AT: null,
  VIEW_COUNT: 0,
  CREATED_AT: new Date('2024-01-01T00:00:00Z'),
  UPDATED_AT: new Date('2024-01-01T00:00:00Z'),
  DELETED_AT: null,
};

const revisionRow = {
  ID: REV_RAW,
  PAGE_ID: RAW_ID,
  TITLE: 'Hello World',
  BLOCKS: JSON.stringify([{ blockType: 'text', blockOrder: 1, content: { text: 'Hi' } }]),
  CREATED_BY: AUTHOR_RAW,
  CREATED_AT: new Date('2024-01-02T00:00:00Z'),
};

const blockRow = {
  ID: RAW_ID,
  PAGE_ID: RAW_ID,
  BLOCK_TYPE: 'text',
  BLOCK_ORDER: 1,
  CONTENT: '{"text":"Hello"}',
  CREATED_AT: new Date('2024-01-01T00:00:00Z'),
};

describe('ContentRepository', () => {
  let repo: ContentRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ContentRepository,
        { provide: DB_SERVICE, useValue: mockDb },
      ],
    }).compile();
    repo = module.get(ContentRepository);
  });

  describe('createPage', () => {
    it('inserts page and returns mapped entity', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.query.mockResolvedValueOnce([pageRow]);
      const page = await repo.createPage({
        title: 'Hello World',
        slug: 'hello-world',
        authorId: AUTHOR_UUID,
      });
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO PAGES'),
        expect.objectContaining({ title: 'Hello World', slug: 'hello-world' }),
      );
      expect(page.id).toBe(UUID_ID);
      expect(page.slug).toBe('hello-world');
      expect(page.status).toBe('draft');
    });
  });

  describe('findById', () => {
    it('returns mapped page when row exists', async () => {
      mockDb.query.mockResolvedValueOnce([pageRow]);
      const page = await repo.findById(UUID_ID);
      expect(page).not.toBeNull();
      if (page == null) return;
      expect(page.id).toBe(UUID_ID);
      expect(page.authorId).toBe(AUTHOR_UUID);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('HEXTORAW'),
        expect.objectContaining({ id: RAW_ID }),
      );
    });

    it('returns null when no row found', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      expect(await repo.findById(UUID_ID)).toBeNull();
    });

    it('excludes soft-deleted rows by default', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await repo.findById(UUID_ID);
      const [sql] = mockDb.query.mock.calls[0] as [string, unknown];
      expect(sql).toContain('DELETED_AT IS NULL');
    });
  });

  describe('findBySlug', () => {
    it('returns page by slug', async () => {
      mockDb.query.mockResolvedValueOnce([pageRow]);
      const page = await repo.findBySlug('hello-world');
      expect(page).not.toBeNull();
      if (page == null) return;
      expect(page.slug).toBe('hello-world');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SLUG'),
        expect.objectContaining({ slug: 'hello-world' }),
      );
    });

    it('returns null when slug not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      expect(await repo.findBySlug('missing')).toBeNull();
    });
  });

  describe('updatePage', () => {
    it('includes only provided fields in SET clause', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.query.mockResolvedValueOnce([pageRow]);
      await repo.updatePage(UUID_ID, { title: 'New Title' });
      const [sql, binds] = mockDb.execute.mock.calls[0] as [string, Record<string, unknown>];
      expect(sql).toContain('TITLE = :title');
      expect(sql).not.toContain(':slug');
      expect(binds['title']).toBe('New Title');
    });

    it('always sets UPDATED_AT = SYSTIMESTAMP', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.query.mockResolvedValueOnce([pageRow]);
      await repo.updatePage(UUID_ID, {});
      const [sql] = mockDb.execute.mock.calls[0] as [string, unknown];
      expect(sql).toContain('UPDATED_AT = SYSTIMESTAMP');
    });
  });

  describe('softDeletePage', () => {
    it('sets DELETED_AT on the row', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      await repo.softDeletePage(UUID_ID);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETED_AT'),
        expect.objectContaining({ id: RAW_ID }),
      );
    });
  });

  describe('listPages', () => {
    it('returns page without cursor', async () => {
      mockDb.query.mockResolvedValueOnce([pageRow]);
      const result = await repo.listPages({}, null, 10);
      expect(result.data).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it('sets nextCursor when more rows available', async () => {
      const rows = Array.from({ length: 11 }, () => ({ ...pageRow }));
      mockDb.query.mockResolvedValueOnce(rows);
      const result = await repo.listPages({}, null, 10);
      expect(result.data).toHaveLength(10);
      expect(result.nextCursor).not.toBeNull();
    });

    it('filters by status when provided', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await repo.listPages({ status: 'published' }, null, 10);
      const [sql] = mockDb.query.mock.calls[0] as [string, unknown];
      expect(sql).toContain('STATUS');
    });

    it('filters by authorId when provided', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await repo.listPages({ authorId: AUTHOR_UUID }, null, 10);
      const [sql] = mockDb.query.mock.calls[0] as [string, unknown];
      expect(sql).toContain('AUTHOR_ID');
    });

    it('caps page size at 100', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await repo.listPages({}, null, 9999);
      const [, binds] = mockDb.query.mock.calls[0] as [string, Record<string, unknown>];
      expect(binds['pageSize']).toBe(101);
    });
  });

  describe('upsertBlocks', () => {
    it('deletes existing blocks and inserts new ones', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.executeBatch.mockResolvedValueOnce(undefined);
      await repo.upsertBlocks(UUID_ID, [
        { blockType: 'text', blockOrder: 1, content: { text: 'Hello' } },
      ]);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM BLOCKS'),
        expect.objectContaining({ pageId: RAW_ID }),
      );
      expect(mockDb.executeBatch).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO BLOCKS'),
        expect.arrayContaining([
          expect.objectContaining({ blockType: 'text', blockOrder: 1 }),
        ]),
      );
    });

    it('skips executeBatch when blocks array is empty', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      await repo.upsertBlocks(UUID_ID, []);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM BLOCKS'),
        expect.anything(),
      );
      expect(mockDb.executeBatch).not.toHaveBeenCalled();
    });
  });

  describe('findBlocksByPageId', () => {
    it('returns mapped blocks ordered by BLOCK_ORDER', async () => {
      mockDb.query.mockResolvedValueOnce([blockRow]);
      const blocks = await repo.findBlocksByPageId(UUID_ID);
      expect(blocks).toHaveLength(1);
      const first = blocks[0];
      if (first == null) return;
      expect(first.blockType).toBe('text');
      expect(first.content).toEqual({ text: 'Hello' });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY'),
        expect.objectContaining({ pageId: RAW_ID }),
      );
    });
  });

  describe('createRevision', () => {
    const revData: CreateRevisionData = {
      pageId: UUID_ID,
      title: 'Hello World',
      blocks: [{ blockType: 'text', blockOrder: 1, content: { text: 'Hi' } }],
      createdBy: AUTHOR_UUID,
    };

    it('inserts revision and returns mapped entity', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.query.mockResolvedValueOnce([revisionRow]);
      const rev = await repo.createRevision(revData);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO REVISIONS'),
        expect.objectContaining({ pageId: RAW_ID, title: 'Hello World' }),
      );
      expect(rev.id).toBe(REV_UUID);
      expect(rev.pageId).toBe(UUID_ID);
      expect(rev.createdBy).toBe(AUTHOR_UUID);
      expect(rev.blocks).toHaveLength(1);
    });

    it('stores blocks as JSON string', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.query.mockResolvedValueOnce([revisionRow]);
      await repo.createRevision(revData);
      const [, binds] = mockDb.execute.mock.calls[0] as [string, Record<string, unknown>];
      expect(typeof binds['blocks']).toBe('string');
      expect(JSON.parse(binds['blocks'] as string)).toHaveLength(1);
    });

    it('handles null createdBy', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.query.mockResolvedValueOnce([{ ...revisionRow, CREATED_BY: null }]);
      const rev = await repo.createRevision({ ...revData, createdBy: null });
      const [, binds] = mockDb.execute.mock.calls[0] as [string, Record<string, unknown>];
      expect(binds['createdBy']).toBeNull();
      expect(rev.createdBy).toBeNull();
    });
  });

  describe('listRevisions', () => {
    it('returns revisions without cursor', async () => {
      mockDb.query.mockResolvedValueOnce([revisionRow]);
      const result = await repo.listRevisions(UUID_ID, null, 10);
      expect(result.data).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
      const [sql] = mockDb.query.mock.calls[0] as [string, unknown];
      expect(sql).toContain('ORDER BY CREATED_AT DESC');
    });

    it('sets nextCursor when more rows available', async () => {
      const rows = Array.from({ length: 11 }, () => ({ ...revisionRow }));
      mockDb.query.mockResolvedValueOnce(rows);
      const result = await repo.listRevisions(UUID_ID, null, 10);
      expect(result.data).toHaveLength(10);
      expect(result.nextCursor).not.toBeNull();
    });

    it('caps page size at 100', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await repo.listRevisions(UUID_ID, null, 9999);
      const [, binds] = mockDb.query.mock.calls[0] as [string, Record<string, unknown>];
      expect(binds['pageSize']).toBe(101);
    });
  });

  describe('findRevision', () => {
    it('returns mapped revision when found', async () => {
      mockDb.query.mockResolvedValueOnce([revisionRow]);
      const rev = await repo.findRevision(UUID_ID, REV_UUID);
      expect(rev).not.toBeNull();
      if (rev == null) return;
      expect(rev.id).toBe(REV_UUID);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('REVISIONS'),
        expect.objectContaining({ id: REV_RAW, pageId: RAW_ID }),
      );
    });

    it('returns null when revision not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      expect(await repo.findRevision(UUID_ID, REV_UUID)).toBeNull();
    });
  });

  describe('restoreRevision', () => {
    it('updates page title and upserts blocks from snapshot', async () => {
      // findRevision query
      mockDb.query.mockResolvedValueOnce([revisionRow]);
      // updatePage execute + findById query
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.query.mockResolvedValueOnce([pageRow]);
      // upsertBlocks: DELETE execute + executeBatch
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.executeBatch.mockResolvedValueOnce(undefined);
      // findById after restore
      mockDb.query.mockResolvedValueOnce([pageRow]);

      const page = await repo.restoreRevision(UUID_ID, REV_UUID);
      expect(page).not.toBeNull();
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE PAGES'),
        expect.objectContaining({ title: 'Hello World' }),
      );
      expect(mockDb.executeBatch).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO BLOCKS'),
        expect.arrayContaining([expect.objectContaining({ blockType: 'text' })]),
      );
    });

    it('returns null when revision does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      expect(await repo.restoreRevision(UUID_ID, REV_UUID)).toBeNull();
    });
  });
});
