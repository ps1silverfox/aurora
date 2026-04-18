import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { RolesGuard } from '../users/roles.guard';
import { Roles } from '../users/roles.decorator';
import { ValidationError } from '../common/errors';

function parseLimit(raw: string | undefined): number {
  const n = raw != null ? parseInt(raw, 10) : 20;
  if (isNaN(n) || n < 1 || n > 100) throw new ValidationError('limit must be 1–100');
  return n;
}

@Controller('api/v1/search')
@UseGuards(RolesGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Roles('content.pages.read')
  async search(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    if (!q || q.trim() === '') throw new ValidationError('q parameter is required');
    return this.searchService.search({
      query: q.trim(),
      status,
      cursor,
      limit: parseLimit(limit),
    });
  }
}
