import { Inject, Injectable } from '@nestjs/common';
import { ContentRepository, CreatePageData, BlockInput, PageFilters } from './content.repository';
import { AuditService } from '../audit/audit.service';
import { EVENT_PUBLISHER, IEventPublisher } from '../events/event-publisher.interface';
import { Page } from './entities/page.entity';
import { Block } from './entities/block.entity';
import { Revision } from './entities/revision.entity';
import { CursorPage } from '../common/pagination';

export interface CreatePageDto {
  title: string;
  slug?: string;
  authorId?: string | null;
  scheduledAt?: Date | null;
  blocks?: BlockInput[];
}

export interface UpdatePageDto {
  title?: string;
  slug?: string;
  scheduledAt?: Date | null;
  blocks?: BlockInput[];
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class ContentService {
  constructor(
    private readonly repo: ContentRepository,
    private readonly audit: AuditService,
    @Inject(EVENT_PUBLISHER) private readonly events: IEventPublisher,
  ) {}

  async createPage(dto: CreatePageDto, actorId: string | null): Promise<Page> {
    const slug = dto.slug ?? slugify(dto.title);
    const createData: CreatePageData = {
      title: dto.title,
      slug,
      authorId: dto.authorId ?? null,
      scheduledAt: dto.scheduledAt ?? null,
    };
    const page = await this.repo.createPage(createData);

    if (dto.blocks && dto.blocks.length > 0) {
      await this.repo.upsertBlocks(page.id, dto.blocks);
    }

    this.events.publish('content.created', { id: page.id, slug: page.slug, title: page.title });
    await this.audit.log({
      actorId,
      action: 'content.create',
      entityType: 'page',
      entityId: page.id,
      diff: { title: page.title, slug: page.slug },
    });
    return page;
  }

  async updatePage(id: string, dto: UpdatePageDto, actorId: string | null): Promise<Page | null> {
    const existing = await this.repo.findById(id);
    if (existing == null) return null;

    const currentBlocks = await this.repo.findBlocksByPageId(id);
    await this.repo.createRevision({
      pageId: id,
      title: existing.title,
      blocks: currentBlocks.map((b) => ({
        blockType: b.blockType,
        blockOrder: b.blockOrder,
        content: b.content,
      })),
      createdBy: actorId,
    });

    const updated = await this.repo.updatePage(id, {
      title: dto.title,
      slug: dto.slug,
      scheduledAt: dto.scheduledAt,
    });

    if (dto.blocks !== undefined) {
      await this.repo.upsertBlocks(id, dto.blocks);
    }

    this.events.publish('content.updated', { id, title: dto.title });
    await this.audit.log({
      actorId,
      action: 'content.update',
      entityType: 'page',
      entityId: id,
      diff: { ...dto },
    });
    return updated;
  }

  async deletePage(id: string, actorId: string | null): Promise<void> {
    const page = await this.repo.findById(id);
    if (page == null) return;

    await this.repo.softDeletePage(id);
    this.events.publish('content.deleted', { id, slug: page.slug });
    await this.audit.log({
      actorId,
      action: 'content.delete',
      entityType: 'page',
      entityId: id,
    });
  }

  async getPage(id: string): Promise<Page | null> {
    return this.repo.findById(id);
  }

  async getPageBySlug(slug: string): Promise<Page | null> {
    return this.repo.findBySlug(slug);
  }

  async getBlocksByPageId(pageId: string): Promise<Block[]> {
    return this.repo.findBlocksByPageId(pageId);
  }

  async listPages(
    filters: PageFilters,
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<Page>> {
    return this.repo.listPages(filters, cursor, limit);
  }

  async listRevisions(
    pageId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<Revision>> {
    return this.repo.listRevisions(pageId, cursor, limit);
  }

  async getRevision(pageId: string, revisionId: string): Promise<Revision | null> {
    return this.repo.findRevision(pageId, revisionId);
  }

  async restoreRevision(
    pageId: string,
    revisionId: string,
    actorId: string | null,
  ): Promise<Page | null> {
    const page = await this.repo.findById(pageId);
    if (page == null) return null;

    const restored = await this.repo.restoreRevision(pageId, revisionId);
    if (restored == null) return null;

    await this.audit.log({
      actorId,
      action: 'content.restore',
      entityType: 'page',
      entityId: pageId,
      diff: { revisionId },
    });
    this.events.publish('content.restored', { pageId, revisionId });
    return restored;
  }
}
