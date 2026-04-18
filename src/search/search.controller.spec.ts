// @csv-mode
import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { RolesGuard } from '../users/roles.guard';
import { ValidationError } from '../common/errors';

const mockSearchService = {
  search: jest.fn(),
};

const samplePage = {
  data: [
    { id: 'page-uuid-1', title: 'Hello World', slug: 'hello-world', score: 85, publishedAt: null },
  ],
  nextCursor: null,
  prevCursor: null,
};

describe('SearchController', () => {
  let controller: SearchController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        { provide: SearchService, useValue: mockSearchService },
        { provide: RolesGuard, useValue: { canActivate: () => true } },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(SearchController);
  });

  describe('search', () => {
    it('throws ValidationError when q is missing', async () => {
      await expect(controller.search(undefined, undefined, undefined, undefined)).rejects.toBeInstanceOf(
        ValidationError,
      );
    });

    it('throws ValidationError when q is blank string', async () => {
      await expect(controller.search('   ', undefined, undefined, undefined)).rejects.toBeInstanceOf(
        ValidationError,
      );
    });

    it('delegates to searchService.search with trimmed query', async () => {
      mockSearchService.search.mockResolvedValue(samplePage);

      const result = await controller.search('  hello  ', undefined, undefined, undefined);

      expect(mockSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'hello', limit: 20 }),
      );
      expect(result).toEqual(samplePage);
    });

    it('passes status, cursor, and limit to service', async () => {
      mockSearchService.search.mockResolvedValue(samplePage);

      await controller.search('hello', 'published', 'cursor-abc', '10');

      expect(mockSearchService.search).toHaveBeenCalledWith({
        query: 'hello',
        status: 'published',
        cursor: 'cursor-abc',
        limit: 10,
      });
    });

    it('throws ValidationError when limit is out of range', async () => {
      await expect(controller.search('hello', undefined, undefined, '999')).rejects.toBeInstanceOf(
        ValidationError,
      );
    });

    it('returns cursor page from searchService', async () => {
      mockSearchService.search.mockResolvedValue(samplePage);
      const result = await controller.search('hello', undefined, undefined, undefined);
      expect(result).toEqual(samplePage);
    });
  });
});
