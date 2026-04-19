import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TaxonomyService } from './taxonomy.service';
import { DB_SERVICE } from '../db/db.interface';

const catRow = { ID: '1', NAME: 'Tech', SLUG: 'tech', PARENT_ID: null, SORT_ORDER: '0' };
const tagRow = { ID: '10', NAME: 'NestJS', SLUG: 'nestjs' };

const mockDb = {
  query: jest.fn(),
  execute: jest.fn(),
  executeOut: jest.fn(),
  executeBatch: jest.fn(),
};

describe('TaxonomyService', () => {
  let service: TaxonomyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaxonomyService, { provide: DB_SERVICE, useValue: mockDb }],
    }).compile();

    service = module.get(TaxonomyService);
    jest.resetAllMocks();
    mockDb.execute.mockResolvedValue(undefined);
    mockDb.executeBatch.mockResolvedValue(undefined);
  });

  // ── Categories ──────────────────────────────────────────────────────────

  describe('listCategories()', () => {
    it('maps rows to Category objects', async () => {
      mockDb.query.mockResolvedValueOnce([catRow]);
      const result = await service.listCategories();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 1, name: 'Tech', slug: 'tech', parentId: null, sortOrder: 0 });
    });

    it('returns empty array when no rows', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      expect(await service.listCategories()).toEqual([]);
    });
  });

  describe('getCategory()', () => {
    it('returns category by id', async () => {
      mockDb.query.mockResolvedValueOnce([catRow]);
      const cat = await service.getCategory(1);
      expect(cat.id).toBe(1);
    });

    it('throws NotFoundException when not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await expect(service.getCategory(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCategory()', () => {
    it('inserts and returns new category', async () => {
      mockDb.query.mockResolvedValueOnce([]);             // slug check → no conflict
      mockDb.executeOut.mockResolvedValueOnce({ newId: 1 });
      mockDb.query.mockResolvedValueOnce([catRow]);        // getCategory after insert
      const cat = await service.createCategory({ name: 'Tech', slug: 'tech' });
      expect(cat.slug).toBe('tech');
      expect(mockDb.executeOut).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException on duplicate slug', async () => {
      mockDb.query.mockResolvedValueOnce([catRow]);        // slug check → conflict
      await expect(service.createCategory({ name: 'Tech', slug: 'tech' })).rejects.toThrow(ConflictException);
    });

    it('validates parentId exists before inserting', async () => {
      mockDb.query.mockResolvedValueOnce([]);              // slug check → ok
      mockDb.query.mockResolvedValueOnce([]);              // getCategory(parentId) → not found
      await expect(service.createCategory({ name: 'Sub', slug: 'sub', parentId: 99 })).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCategory()', () => {
    it('updates and returns modified category', async () => {
      mockDb.query.mockResolvedValueOnce([catRow]);                         // getCategory check
      mockDb.query.mockResolvedValueOnce([{ ...catRow, NAME: 'Updated' }]); // getCategory after update
      const cat = await service.updateCategory(1, { name: 'Updated' });
      expect(cat.name).toBe('Updated');
    });

    it('throws NotFoundException for unknown id', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await expect(service.updateCategory(999, { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCategory()', () => {
    it('deletes existing category', async () => {
      mockDb.query.mockResolvedValueOnce([catRow]);
      await service.deleteCategory(1);
      expect(mockDb.execute).toHaveBeenCalledWith(expect.stringContaining('DELETE'), { id: 1 });
    });

    it('throws NotFoundException for unknown id', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await expect(service.deleteCategory(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ── Tags ──────────────────────────────────────────────────────────────────

  describe('listTags()', () => {
    it('maps rows to Tag objects', async () => {
      mockDb.query.mockResolvedValueOnce([tagRow]);
      const tags = await service.listTags();
      expect(tags[0]).toMatchObject({ id: 10, name: 'NestJS', slug: 'nestjs' });
    });
  });

  describe('getTag()', () => {
    it('returns tag by id', async () => {
      mockDb.query.mockResolvedValueOnce([tagRow]);
      const tag = await service.getTag(10);
      expect(tag.id).toBe(10);
    });

    it('throws NotFoundException when not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await expect(service.getTag(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createTag()', () => {
    it('inserts and returns new tag', async () => {
      mockDb.query.mockResolvedValueOnce([]);              // slug check → ok
      mockDb.executeOut.mockResolvedValueOnce({ newId: 10 });
      mockDb.query.mockResolvedValueOnce([tagRow]);        // getTag after insert
      const tag = await service.createTag({ name: 'NestJS', slug: 'nestjs' });
      expect(tag.slug).toBe('nestjs');
    });

    it('throws ConflictException on duplicate slug', async () => {
      mockDb.query.mockResolvedValueOnce([tagRow]);        // slug check → conflict
      await expect(service.createTag({ name: 'NestJS', slug: 'nestjs' })).rejects.toThrow(ConflictException);
    });
  });

  describe('updateTag()', () => {
    it('updates and returns modified tag', async () => {
      mockDb.query.mockResolvedValueOnce([tagRow]);                          // getTag check
      mockDb.query.mockResolvedValueOnce([{ ...tagRow, NAME: 'Updated' }]); // getTag after update
      const tag = await service.updateTag(10, { name: 'Updated' });
      expect(tag.name).toBe('Updated');
    });
  });

  describe('deleteTag()', () => {
    it('deletes existing tag', async () => {
      mockDb.query.mockResolvedValueOnce([tagRow]);
      await service.deleteTag(10);
      expect(mockDb.execute).toHaveBeenCalledWith(expect.stringContaining('DELETE'), { id: 10 });
    });
  });

  // ── Page associations ─────────────────────────────────────────────────────

  const pageId = '550e8400-e29b-41d4-a716-446655440000';

  describe('attachCategory()', () => {
    it('issues MERGE when category exists', async () => {
      mockDb.query.mockResolvedValueOnce([catRow]);        // getCategory check
      await service.attachCategory(pageId, 1);
      expect(mockDb.execute).toHaveBeenCalledWith(expect.stringContaining('MERGE'), expect.any(Object));
    });

    it('throws NotFoundException for unknown category', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await expect(service.attachCategory(pageId, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('detachCategory()', () => {
    it('deletes pivot row', async () => {
      await service.detachCategory(pageId, 1);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM PAGE_CATEGORIES'),
        expect.any(Object),
      );
    });
  });

  describe('attachTag()', () => {
    it('issues MERGE when tag exists', async () => {
      mockDb.query.mockResolvedValueOnce([tagRow]);
      await service.attachTag(pageId, 10);
      expect(mockDb.execute).toHaveBeenCalledWith(expect.stringContaining('MERGE'), expect.any(Object));
    });
  });

  describe('detachTag()', () => {
    it('deletes pivot row', async () => {
      await service.detachTag(pageId, 10);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM PAGE_TAGS'),
        expect.any(Object),
      );
    });
  });

  describe('getPageCategories()', () => {
    it('returns categories for page', async () => {
      mockDb.query.mockResolvedValueOnce([catRow]);
      const cats = await service.getPageCategories(pageId);
      expect(cats).toHaveLength(1);
      expect(cats[0]?.slug).toBe('tech');
    });
  });

  describe('getPageTags()', () => {
    it('returns tags for page', async () => {
      mockDb.query.mockResolvedValueOnce([tagRow]);
      const tags = await service.getPageTags(pageId);
      expect(tags).toHaveLength(1);
      expect(tags[0]?.slug).toBe('nestjs');
    });
  });
});
