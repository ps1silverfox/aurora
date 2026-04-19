import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DB_SERVICE, IDbService } from '../db/db.interface';

export interface Category {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  sortOrder: number;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export interface CreateCategoryDto {
  name: string;
  slug: string;
  parentId?: number | null;
  sortOrder?: number;
}

export interface UpdateCategoryDto {
  name?: string;
  slug?: string;
  parentId?: number | null;
  sortOrder?: number;
}

export interface CreateTagDto {
  name: string;
  slug: string;
}

export interface UpdateTagDto {
  name?: string;
  slug?: string;
}

interface CategoryRow {
  ID: string;
  NAME: string;
  SLUG: string;
  PARENT_ID: string | null;
  SORT_ORDER: string;
}

interface TagRow {
  ID: string;
  NAME: string;
  SLUG: string;
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: Number(row.ID),
    name: row.NAME,
    slug: row.SLUG,
    parentId: row.PARENT_ID ? Number(row.PARENT_ID) : null,
    sortOrder: Number(row.SORT_ORDER),
  };
}

function mapTag(row: TagRow): Tag {
  return { id: Number(row.ID), name: row.NAME, slug: row.SLUG };
}

@Injectable()
export class TaxonomyService {
  constructor(@Inject(DB_SERVICE) private readonly db: IDbService) {}

  // ── Categories ──────────────────────────────────────────────────────────

  async listCategories(): Promise<Category[]> {
    const rows = await this.db.query<CategoryRow>(
      'SELECT ID, NAME, SLUG, PARENT_ID, SORT_ORDER FROM CATEGORIES ORDER BY SORT_ORDER, ID',
    );
    return rows.map(mapCategory);
  }

  async getCategory(id: number): Promise<Category> {
    const rows = await this.db.query<CategoryRow>(
      'SELECT ID, NAME, SLUG, PARENT_ID, SORT_ORDER FROM CATEGORIES WHERE ID = :id',
      { id },
    );
    if (!rows[0]) throw new NotFoundException(`Category ${id} not found`);
    return mapCategory(rows[0]);
  }

  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    const existing = await this.db.query<CategoryRow>(
      'SELECT ID FROM CATEGORIES WHERE SLUG = :slug',
      { slug: dto.slug },
    );
    if (existing.length > 0) throw new ConflictException(`Slug "${dto.slug}" already exists`);

    if (dto.parentId != null) await this.getCategory(dto.parentId);

    const out = await this.db.executeOut(
      `INSERT INTO CATEGORIES (NAME, SLUG, PARENT_ID, SORT_ORDER)
       VALUES (:name, :slug, :parentId, :sortOrder)
       RETURNING ID INTO :newId`,
      {
        name: dto.name,
        slug: dto.slug,
        parentId: dto.parentId ?? null,
        sortOrder: dto.sortOrder ?? 0,
        newId: { dir: 'out', type: 'number' },
      },
    );

    return this.getCategory(Number(out['newId']));
  }

  async updateCategory(id: number, dto: UpdateCategoryDto): Promise<Category> {
    await this.getCategory(id);

    if (dto.slug != null) {
      const conflict = await this.db.query<CategoryRow>(
        'SELECT ID FROM CATEGORIES WHERE SLUG = :slug AND ID != :id',
        { slug: dto.slug, id },
      );
      if (conflict.length > 0) throw new ConflictException(`Slug "${dto.slug}" already exists`);
    }

    if (dto.parentId != null) await this.getCategory(dto.parentId);

    await this.db.execute(
      `UPDATE CATEGORIES SET
         NAME = COALESCE(:name, NAME),
         SLUG = COALESCE(:slug, SLUG),
         PARENT_ID = CASE WHEN :hasParent = 1 THEN :parentId ELSE PARENT_ID END,
         SORT_ORDER = COALESCE(:sortOrder, SORT_ORDER)
       WHERE ID = :id`,
      {
        name: dto.name ?? null,
        slug: dto.slug ?? null,
        hasParent: dto.parentId !== undefined ? 1 : 0,
        parentId: dto.parentId ?? null,
        sortOrder: dto.sortOrder ?? null,
        id,
      },
    );

    return this.getCategory(id);
  }

  async deleteCategory(id: number): Promise<void> {
    await this.getCategory(id);
    await this.db.execute('DELETE FROM CATEGORIES WHERE ID = :id', { id });
  }

  // ── Tags ─────────────────────────────────────────────────────────────────

  async listTags(): Promise<Tag[]> {
    const rows = await this.db.query<TagRow>(
      'SELECT ID, NAME, SLUG FROM TAGS ORDER BY NAME',
    );
    return rows.map(mapTag);
  }

  async getTag(id: number): Promise<Tag> {
    const rows = await this.db.query<TagRow>(
      'SELECT ID, NAME, SLUG FROM TAGS WHERE ID = :id',
      { id },
    );
    if (!rows[0]) throw new NotFoundException(`Tag ${id} not found`);
    return mapTag(rows[0]);
  }

  async createTag(dto: CreateTagDto): Promise<Tag> {
    const existing = await this.db.query<TagRow>(
      'SELECT ID FROM TAGS WHERE SLUG = :slug',
      { slug: dto.slug },
    );
    if (existing.length > 0) throw new ConflictException(`Slug "${dto.slug}" already exists`);

    const out = await this.db.executeOut(
      `INSERT INTO TAGS (NAME, SLUG) VALUES (:name, :slug) RETURNING ID INTO :newId`,
      { name: dto.name, slug: dto.slug, newId: { dir: 'out', type: 'number' } },
    );

    return this.getTag(Number(out['newId']));
  }

  async updateTag(id: number, dto: UpdateTagDto): Promise<Tag> {
    await this.getTag(id);

    if (dto.slug != null) {
      const conflict = await this.db.query<TagRow>(
        'SELECT ID FROM TAGS WHERE SLUG = :slug AND ID != :id',
        { slug: dto.slug, id },
      );
      if (conflict.length > 0) throw new ConflictException(`Slug "${dto.slug}" already exists`);
    }

    await this.db.execute(
      `UPDATE TAGS SET NAME = COALESCE(:name, NAME), SLUG = COALESCE(:slug, SLUG) WHERE ID = :id`,
      { name: dto.name ?? null, slug: dto.slug ?? null, id },
    );

    return this.getTag(id);
  }

  async deleteTag(id: number): Promise<void> {
    await this.getTag(id);
    await this.db.execute('DELETE FROM TAGS WHERE ID = :id', { id });
  }

  // ── Page associations ─────────────────────────────────────────────────────

  async attachCategory(pageId: string, categoryId: number): Promise<void> {
    await this.getCategory(categoryId);
    await this.db.execute(
      `MERGE INTO PAGE_CATEGORIES dst
       USING DUAL ON (dst.PAGE_ID = HEXTORAW(:pageId) AND dst.CATEGORY_ID = :categoryId)
       WHEN NOT MATCHED THEN INSERT (PAGE_ID, CATEGORY_ID) VALUES (HEXTORAW(:pageId), :categoryId)`,
      { pageId: pageId.replace(/-/g, ''), categoryId },
    );
  }

  async detachCategory(pageId: string, categoryId: number): Promise<void> {
    await this.db.execute(
      'DELETE FROM PAGE_CATEGORIES WHERE PAGE_ID = HEXTORAW(:pageId) AND CATEGORY_ID = :categoryId',
      { pageId: pageId.replace(/-/g, ''), categoryId },
    );
  }

  async attachTag(pageId: string, tagId: number): Promise<void> {
    await this.getTag(tagId);
    await this.db.execute(
      `MERGE INTO PAGE_TAGS dst
       USING DUAL ON (dst.PAGE_ID = HEXTORAW(:pageId) AND dst.TAG_ID = :tagId)
       WHEN NOT MATCHED THEN INSERT (PAGE_ID, TAG_ID) VALUES (HEXTORAW(:pageId), :tagId)`,
      { pageId: pageId.replace(/-/g, ''), tagId },
    );
  }

  async detachTag(pageId: string, tagId: number): Promise<void> {
    await this.db.execute(
      'DELETE FROM PAGE_TAGS WHERE PAGE_ID = HEXTORAW(:pageId) AND TAG_ID = :tagId',
      { pageId: pageId.replace(/-/g, ''), tagId },
    );
  }

  async getPageCategories(pageId: string): Promise<Category[]> {
    const rows = await this.db.query<CategoryRow>(
      `SELECT c.ID, c.NAME, c.SLUG, c.PARENT_ID, c.SORT_ORDER
       FROM CATEGORIES c
       JOIN PAGE_CATEGORIES pc ON pc.CATEGORY_ID = c.ID
       WHERE pc.PAGE_ID = HEXTORAW(:pageId)
       ORDER BY c.SORT_ORDER, c.ID`,
      { pageId: pageId.replace(/-/g, '') },
    );
    return rows.map(mapCategory);
  }

  async getPageTags(pageId: string): Promise<Tag[]> {
    const rows = await this.db.query<TagRow>(
      `SELECT t.ID, t.NAME, t.SLUG
       FROM TAGS t
       JOIN PAGE_TAGS pt ON pt.TAG_ID = t.ID
       WHERE pt.PAGE_ID = HEXTORAW(:pageId)
       ORDER BY t.NAME`,
      { pageId: pageId.replace(/-/g, '') },
    );
    return rows.map(mapTag);
  }
}
