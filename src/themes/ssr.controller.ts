import {
  Controller,
  Get,
  Param,
  NotFoundException,
  Header,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ThemeService } from './theme.service';
import { RendererService, BlockData } from './renderer.service';
import { ContentService } from '../content/content.service';
import { Public } from '../auth/public.decorator';
import { RolesGuard } from '../users/roles.guard';
import { Roles } from '../users/roles.decorator';

@Controller()
export class SsrController {
  constructor(
    private readonly themeService: ThemeService,
    private readonly rendererService: RendererService,
    private readonly contentService: ContentService,
  ) {}

  /**
   * Render a draft or published page for preview (authenticated editors/admins only).
   * Returns the full HTML response via the active theme.
   */
  @Get('api/v1/pages/:id/preview')
  @UseGuards(RolesGuard)
  @Roles('content.pages.read')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async previewPage(@Param('id') id: string): Promise<string> {
    const [page, theme] = await Promise.all([
      this.contentService.getPage(id),
      this.themeService.getActive(),
    ]);

    if (!page) throw new NotFoundException(`Page ${id} not found`);
    if (!theme) throw new NotFoundException('No active theme configured');

    const blocks = await this.contentService.getBlocksByPageId(id);
    const blockData: BlockData[] = blocks.map((b) => ({
      blockType: b.blockType,
      blockOrder: b.blockOrder,
      content: b.content,
    }));

    return this.rendererService.renderPage(page, blockData, theme);
  }

  /**
   * SSR catch-all: resolves a URL path as a page slug and renders it with the active theme.
   * Only matches published pages; returns 404 for anything else.
   * Must be registered last so API routes take precedence.
   */
  @Get('*')
  @Public()
  @Header('Content-Type', 'text/html; charset=utf-8')
  async ssrPage(@Req() req: Request): Promise<string> {
    const slug = req.path.replace(/^\//, '').replace(/\/$/, '') || 'index';

    const [page, theme] = await Promise.all([
      this.contentService.getPageBySlug(slug),
      this.themeService.getActive(),
    ]);

    if (!page || page.status !== 'published') {
      throw new NotFoundException(`Page "${slug}" not found`);
    }
    if (!theme) throw new NotFoundException('No active theme configured');

    const blocks = await this.contentService.getBlocksByPageId(page.id);
    const blockData: BlockData[] = blocks.map((b) => ({
      blockType: b.blockType,
      blockOrder: b.blockOrder,
      content: b.content,
    }));

    return this.rendererService.renderPage(page, blockData, theme);
  }
}
