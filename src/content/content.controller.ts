import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  HttpCode,
  Header,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { IsBoolean } from 'class-validator';
import { ContentService } from './content.service';
import { WorkflowService } from './workflow.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { TransitionDto } from './dto/transition.dto';
import { RolesGuard } from '../users/roles.guard';
import { Roles } from '../users/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { AuthenticatedUser } from '../auth/types';
import { NotFoundError, ForbiddenError, ValidationError } from '../common/errors';
import { PageFilters } from './content.repository';
import { PageStatus } from './entities/page.entity';

class RatePageDto {
  @IsBoolean()
  helpful!: boolean;
}

const VALID_STATUSES = new Set<string>(['draft', 'review', 'approved', 'published', 'archived']);

function parseLimit(raw: string | undefined): number {
  const n = raw != null ? parseInt(raw, 10) : 20;
  if (isNaN(n) || n < 1 || n > 100) throw new ValidationError('limit must be 1–100');
  return n;
}

function primaryRole(user: AuthenticatedUser): string {
  return user.roles[0] ?? 'viewer';
}

@Controller('api/v1/pages')
@UseGuards(RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly workflowService: WorkflowService,
    private readonly knowledgeBase: KnowledgeBaseService,
  ) {}

  @Post()
  @Roles('content.pages.create')
  @HttpCode(201)
  async create(@Body() dto: CreatePageDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.contentService.createPage(
      {
        title: dto.title,
        slug: dto.slug,
        authorId: dto.authorId ?? actor.id,
        scheduledAt: dto.scheduledAt != null ? new Date(dto.scheduledAt) : null,
        blocks: dto.blocks,
      },
      actor.id,
    );
  }

  @Get()
  @Roles('content.pages.read')
  async list(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('authorId') authorId?: string,
  ) {
    const pageSize = parseLimit(limit);
    const filters: PageFilters = {};
    if (status != null) {
      if (!VALID_STATUSES.has(status)) throw new ValidationError('invalid status value');
      filters.status = status as PageStatus;
    }
    if (authorId != null) filters.authorId = authorId;
    return this.contentService.listPages(filters, cursor ?? null, pageSize);
  }

  @Get(':id')
  @Roles('content.pages.read')
  async findOne(@Param('id') id: string) {
    const [page, helpfulPct] = await Promise.all([
      this.contentService.getPage(id),
      this.knowledgeBase.getHelpfulPct(id),
    ]);
    if (page == null) throw new NotFoundError(`Page ${id} not found`);
    return { ...page, helpfulPct };
  }

  @Post(':id/view')
  @Public()
  @HttpCode(204)
  async recordView(@Param('id') id: string, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
      ?? req.ip
      ?? 'unknown';
    await this.knowledgeBase.viewPage(id, ip);
  }

  @Post(':id/rate')
  @Public()
  @HttpCode(204)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async ratePage(@Param('id') id: string, @Body() dto: RatePageDto) {
    await this.knowledgeBase.ratePage(id, dto.helpful);
  }

  @Put(':id')
  @Roles('content.pages.read')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const existing = await this.contentService.getPage(id);
    if (existing == null) throw new NotFoundError(`Page ${id} not found`);

    const role = primaryRole(actor);
    const canEditAll = role === 'editor' || role === 'admin';
    if (!canEditAll && existing.authorId !== actor.id) {
      throw new ForbiddenError('Authors may only edit their own pages');
    }

    const updated = await this.contentService.updatePage(
      id,
      {
        title: dto.title,
        slug: dto.slug,
        scheduledAt: dto.scheduledAt != null ? new Date(dto.scheduledAt) : undefined,
        blocks: dto.blocks,
      },
      actor.id,
    );
    if (updated == null) throw new NotFoundError(`Page ${id} not found`);
    return updated;
  }

  @Delete(':id')
  @Roles('content.pages.delete')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    const page = await this.contentService.getPage(id);
    if (page == null) throw new NotFoundError(`Page ${id} not found`);
    await this.contentService.deletePage(id, actor.id);
  }

  @Post(':id/transition')
  @Roles('content.pages.read')
  async transition(
    @Param('id') id: string,
    @Body() dto: TransitionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const result = await this.workflowService.transition(id, dto.action, {
      id: actor.id,
      role: primaryRole(actor),
    });
    if (result == null) throw new NotFoundError(`Page ${id} not found`);
    return result;
  }

  @Get(':id/revisions')
  @Roles('content.revisions.read')
  async listRevisions(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const page = await this.contentService.getPage(id);
    if (page == null) throw new NotFoundError(`Page ${id} not found`);
    return this.contentService.listRevisions(id, cursor ?? null, parseLimit(limit));
  }

  @Get(':id/revisions/:revId')
  @Roles('content.revisions.read')
  async findRevision(@Param('id') id: string, @Param('revId') revId: string) {
    const page = await this.contentService.getPage(id);
    if (page == null) throw new NotFoundError(`Page ${id} not found`);
    const revision = await this.contentService.getRevision(id, revId);
    if (revision == null) throw new NotFoundError(`Revision ${revId} not found`);
    return revision;
  }

  @Get(':id/preview')
  @Roles('content.pages.read')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async previewPage(@Param('id') id: string): Promise<string> {
    const page = await this.contentService.getPage(id);
    if (page == null) throw new NotFoundError(`Page ${id} not found`);
    const title = page.title.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c));
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Preview: ${title}</title></head><body><h1>${title}</h1><p>Status: ${page.status}</p><p>Slug: ${page.slug}</p></body></html>`;
  }

  @Post(':id/revisions/:revId/restore')
  @Roles('content.revisions.restore')
  async restoreRevision(
    @Param('id') id: string,
    @Param('revId') revId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const restored = await this.contentService.restoreRevision(id, revId, actor.id);
    if (restored == null) throw new NotFoundError(`Page ${id} or revision ${revId} not found`);
    return restored;
  }
}
