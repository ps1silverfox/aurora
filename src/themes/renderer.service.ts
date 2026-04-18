import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { Theme } from './theme.entity';
import { Page } from '../content/entities/page.entity';

export interface BlockData {
  blockType: string;
  blockOrder: number;
  content: Record<string, unknown>;
}

type HandlebarsEnv = typeof Handlebars;

@Injectable()
export class RendererService {
  private readonly logger = new Logger(RendererService.name);
  // Cache compiled templates per theme slug
  private readonly templateCache = new Map<string, HandlebarsCompileResult>();
  private readonly hbsEnvCache = new Map<string, HandlebarsEnv>();

  async renderPage(page: Page, blocks: BlockData[], theme: Theme): Promise<string> {
    const hbs = await this.buildHbsEnv(theme);
    const cacheKey = `${theme.slug}:page`;
    let template = this.templateCache.get(cacheKey);
    if (!template) {
      const templatePath = path.join(theme.path, 'templates', 'page.hbs');
      const src = await fs.readFile(templatePath, 'utf-8');
      template = hbs.compile(src);
      this.templateCache.set(cacheKey, template);
    }

    const context = {
      page: {
        title: page.title,
        slug: page.slug,
        publishedAt: page.publishedAt ? page.publishedAt.toISOString().split('T')[0] : null,
      },
      blocks,
    };

    return template(context);
  }

  /** Build a per-theme Handlebars environment with block partials registered. */
  private async buildHbsEnv(theme: Theme): Promise<HandlebarsEnv> {
    const cached = this.hbsEnvCache.get(theme.slug);
    if (cached) return cached;

    const hbs = Handlebars.create();

    // Register `eq` helper for heading level comparisons
    hbs.registerHelper('eq', (a: unknown, b: unknown) => a === b);

    // Dynamic partial lookup: {{> (blockPartial blockType)}}
    hbs.registerHelper('blockPartial', (blockType: string) => blockType);

    // Load all block partials from the theme's blocks/ directory
    const blocksDir = path.join(theme.path, 'blocks');
    let blockFiles: string[] = [];
    try {
      blockFiles = (await fs.readdir(blocksDir)).filter((f) => f.endsWith('.hbs'));
    } catch {
      this.logger.debug(`No blocks directory for theme "${theme.slug}"`);
    }

    for (const file of blockFiles) {
      const blockType = path.basename(file, '.hbs');
      const src = await fs.readFile(path.join(blocksDir, file), 'utf-8');
      hbs.registerPartial(blockType, src);
    }

    this.hbsEnvCache.set(theme.slug, hbs);
    return hbs;
  }

  /** Invalidate cache for a theme (call after theme settings change). */
  invalidateCache(slug: string): void {
    this.templateCache.delete(`${slug}:page`);
    this.hbsEnvCache.delete(slug);
  }
}

type HandlebarsCompileResult = ReturnType<typeof Handlebars.compile>;
