import { Test } from '@nestjs/testing';
import { RendererService, BlockData } from './renderer.service';
import { Theme } from './theme.entity';
import { Page } from '../content/entities/page.entity';
import * as fs from 'fs/promises';

jest.mock('fs/promises');

const mockFs = fs as jest.Mocked<typeof fs>;

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
  id: 'page-1',
  title: 'Test Page',
  slug: 'test-page',
  status: 'published',
  authorId: null,
  publishedAt: new Date('2024-06-01'),
  scheduledAt: null,
  viewCount: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
};

const PAGE_HBS = `<html><head><title>{{page.title}}</title></head><body>{{#each blocks}}{{> (blockPartial this.blockType) block=this}}{{/each}}</body></html>`;
const TEXT_HBS = `<p>{{block.content.text}}</p>`;
const HEADING_HBS = `<h2>{{block.content.text}}</h2>`;
const IMAGE_HBS = `<img src="{{block.content.url}}" alt="{{block.content.alt}}" />`;

describe('RendererService', () => {
  let service: RendererService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [RendererService],
    }).compile();

    service = module.get(RendererService);

    mockFs.readFile.mockImplementation((filePath: unknown) => {
      const p = String(filePath);
      if (p.endsWith('page.hbs')) return Promise.resolve(PAGE_HBS);
      if (p.endsWith('text.hbs')) return Promise.resolve(TEXT_HBS);
      if (p.endsWith('heading.hbs')) return Promise.resolve(HEADING_HBS);
      if (p.endsWith('image.hbs')) return Promise.resolve(IMAGE_HBS);
      return Promise.reject(new Error(`Unexpected read: ${p}`));
    });

    mockFs.readdir.mockResolvedValue(['text.hbs', 'heading.hbs', 'image.hbs'] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
  });

  afterEach(() => jest.clearAllMocks());

  it('renders a page with a text block', async () => {
    const blocks: BlockData[] = [
      { blockType: 'text', blockOrder: 1, content: { text: 'Hello world' } },
    ];
    const html = await service.renderPage(mockPage, blocks, mockTheme);
    expect(html).toContain('<title>Test Page</title>');
    expect(html).toContain('<p>Hello world</p>');
  });

  it('renders a page with a heading block', async () => {
    const blocks: BlockData[] = [
      { blockType: 'heading', blockOrder: 1, content: { text: 'My Heading', level: 2 } },
    ];
    const html = await service.renderPage(mockPage, blocks, mockTheme);
    expect(html).toContain('<h2>My Heading</h2>');
  });

  it('renders a page with an image block', async () => {
    const blocks: BlockData[] = [
      { blockType: 'image', blockOrder: 1, content: { url: '/img/photo.jpg', alt: 'Photo' } },
    ];
    const html = await service.renderPage(mockPage, blocks, mockTheme);
    expect(html).toContain('<img src="/img/photo.jpg" alt="Photo" />');
  });

  it('renders a page with multiple blocks in order', async () => {
    const blocks: BlockData[] = [
      { blockType: 'heading', blockOrder: 1, content: { text: 'Title' } },
      { blockType: 'text', blockOrder: 2, content: { text: 'Body text' } },
    ];
    const html = await service.renderPage(mockPage, blocks, mockTheme);
    const headingPos = html.indexOf('<h2>Title</h2>');
    const textPos = html.indexOf('<p>Body text</p>');
    expect(headingPos).toBeGreaterThanOrEqual(0);
    expect(textPos).toBeGreaterThan(headingPos);
  });

  it('renders empty page (no blocks)', async () => {
    const html = await service.renderPage(mockPage, [], mockTheme);
    expect(html).toContain('<title>Test Page</title>');
  });

  it('uses template cache on second render call', async () => {
    await service.renderPage(mockPage, [], mockTheme);
    await service.renderPage(mockPage, [], mockTheme);
    // readFile for page.hbs called only once (cached after first render)
    const pageHbsCalls = mockFs.readFile.mock.calls.filter((c) => {
      const arg = c[0];
      return typeof arg === 'string' && arg.endsWith('page.hbs');
    });
    expect(pageHbsCalls).toHaveLength(1);
  });

  it('invalidateCache clears the template cache', async () => {
    await service.renderPage(mockPage, [], mockTheme);
    service.invalidateCache(mockTheme.slug);
    await service.renderPage(mockPage, [], mockTheme);
    const pageHbsCalls = mockFs.readFile.mock.calls.filter((c) => {
      const arg = c[0];
      return typeof arg === 'string' && arg.endsWith('page.hbs');
    });
    expect(pageHbsCalls).toHaveLength(2);
  });

  it('handles theme with no blocks directory gracefully', async () => {
    mockFs.readdir.mockRejectedValueOnce(new Error('ENOENT'));
    await expect(service.renderPage(mockPage, [], mockTheme)).resolves.toBeDefined();
  });
});
