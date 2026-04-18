// @csv-mode
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SsrController } from './ssr.controller';
import { ThemeService } from './theme.service';
import { RendererService } from './renderer.service';
import { ContentService } from '../content/content.service';
import { RolesGuard } from '../users/roles.guard';
import type { Request } from 'express';
import { Theme } from './theme.entity';
import { Page } from '../content/entities/page.entity';
import { Block } from '../content/entities/block.entity';

const mockTheme: Theme = {
  id: 1,
  name: 'Aurora Default',
  slug: 'aurora-default',
  path: '/themes/aurora-default',
  isActive: true,
  settings: {},
  createdAt: new Date('2024-01-01'),
};

const mockPage: Page = {
  id: 'abc-123',
  title: 'Hello World',
  slug: 'hello-world',
  status: 'published',
  authorId: null,
  publishedAt: new Date('2024-06-01'),
  scheduledAt: null,
  viewCount: 10,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
};

const mockBlocks: Block[] = [
  {
    id: 'b1',
    pageId: 'abc-123',
    blockType: 'text',
    blockOrder: 1,
    content: { text: 'Hello world' },
    createdAt: new Date('2024-01-01'),
  },
];

const RENDERED_HTML = '<html><body><p>Hello world</p></body></html>';

const mockThemeService = {
  getActive: jest.fn(),
};

const mockRendererService = {
  renderPage: jest.fn(),
};

const mockContentService = {
  getPage: jest.fn(),
  getPageBySlug: jest.fn(),
  getBlocksByPageId: jest.fn(),
};

function mockRequest(path: string): Request {
  return { path } as Request;
}

describe('SsrController', () => {
  let controller: SsrController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SsrController],
      providers: [
        { provide: ThemeService, useValue: mockThemeService },
        { provide: RendererService, useValue: mockRendererService },
        { provide: ContentService, useValue: mockContentService },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(SsrController);
    jest.clearAllMocks();
  });

  describe('previewPage', () => {
    it('renders draft/published page as HTML', async () => {
      const draftPage = { ...mockPage, status: 'draft' as const };
      mockContentService.getPage.mockResolvedValue(draftPage);
      mockThemeService.getActive.mockResolvedValue(mockTheme);
      mockContentService.getBlocksByPageId.mockResolvedValue(mockBlocks);
      mockRendererService.renderPage.mockResolvedValue(RENDERED_HTML);

      const result = await controller.previewPage('abc-123');

      expect(result).toBe(RENDERED_HTML);
      expect(mockRendererService.renderPage).toHaveBeenCalledWith(
        draftPage,
        [{ blockType: 'text', blockOrder: 1, content: { text: 'Hello world' } }],
        mockTheme,
      );
    });

    it('throws NotFoundException when page not found', async () => {
      mockContentService.getPage.mockResolvedValue(null);
      mockThemeService.getActive.mockResolvedValue(mockTheme);

      await expect(controller.previewPage('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when no active theme', async () => {
      mockContentService.getPage.mockResolvedValue(mockPage);
      mockThemeService.getActive.mockResolvedValue(null);

      await expect(controller.previewPage('abc-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('ssrPage', () => {
    it('renders a published page by slug', async () => {
      mockContentService.getPageBySlug.mockResolvedValue(mockPage);
      mockThemeService.getActive.mockResolvedValue(mockTheme);
      mockContentService.getBlocksByPageId.mockResolvedValue(mockBlocks);
      mockRendererService.renderPage.mockResolvedValue(RENDERED_HTML);

      const result = await controller.ssrPage(mockRequest('/hello-world'));

      expect(result).toBe(RENDERED_HTML);
      expect(mockContentService.getPageBySlug).toHaveBeenCalledWith('hello-world');
    });

    it('strips leading and trailing slashes from slug', async () => {
      mockContentService.getPageBySlug.mockResolvedValue(mockPage);
      mockThemeService.getActive.mockResolvedValue(mockTheme);
      mockContentService.getBlocksByPageId.mockResolvedValue([]);
      mockRendererService.renderPage.mockResolvedValue(RENDERED_HTML);

      await controller.ssrPage(mockRequest('/hello-world/'));

      expect(mockContentService.getPageBySlug).toHaveBeenCalledWith('hello-world');
    });

    it('uses "index" slug for root path', async () => {
      mockContentService.getPageBySlug.mockResolvedValue(mockPage);
      mockThemeService.getActive.mockResolvedValue(mockTheme);
      mockContentService.getBlocksByPageId.mockResolvedValue([]);
      mockRendererService.renderPage.mockResolvedValue(RENDERED_HTML);

      await controller.ssrPage(mockRequest('/'));

      expect(mockContentService.getPageBySlug).toHaveBeenCalledWith('index');
    });

    it('throws NotFoundException when slug not found', async () => {
      mockContentService.getPageBySlug.mockResolvedValue(null);
      mockThemeService.getActive.mockResolvedValue(mockTheme);

      await expect(controller.ssrPage(mockRequest('/nonexistent'))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for non-published pages', async () => {
      const draftPage = { ...mockPage, status: 'draft' as const };
      mockContentService.getPageBySlug.mockResolvedValue(draftPage);
      mockThemeService.getActive.mockResolvedValue(mockTheme);

      await expect(controller.ssrPage(mockRequest('/hello-world'))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when no active theme', async () => {
      mockContentService.getPageBySlug.mockResolvedValue(mockPage);
      mockThemeService.getActive.mockResolvedValue(null);

      await expect(controller.ssrPage(mockRequest('/hello-world'))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('passes block data correctly to renderer', async () => {
      const multiBlocks: Block[] = [
        { id: 'b1', pageId: 'abc-123', blockType: 'heading', blockOrder: 1, content: { text: 'Title' }, createdAt: new Date() },
        { id: 'b2', pageId: 'abc-123', blockType: 'text', blockOrder: 2, content: { text: 'Body' }, createdAt: new Date() },
      ];
      mockContentService.getPageBySlug.mockResolvedValue(mockPage);
      mockThemeService.getActive.mockResolvedValue(mockTheme);
      mockContentService.getBlocksByPageId.mockResolvedValue(multiBlocks);
      mockRendererService.renderPage.mockResolvedValue(RENDERED_HTML);

      await controller.ssrPage(mockRequest('/hello-world'));

      expect(mockRendererService.renderPage).toHaveBeenCalledWith(
        mockPage,
        [
          { blockType: 'heading', blockOrder: 1, content: { text: 'Title' } },
          { blockType: 'text', blockOrder: 2, content: { text: 'Body' } },
        ],
        mockTheme,
      );
    });
  });
});
