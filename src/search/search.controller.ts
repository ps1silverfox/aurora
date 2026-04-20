import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { RolesGuard } from '../users/roles.guard';
import { Roles } from '../users/roles.decorator';
import { BadRequestError } from '../common/errors';

const MIN_QUERY_LENGTH = 2;

function parseLimit(raw: string | undefined): number {
  const n = raw != null ? parseInt(raw, 10) : 20;
  if (isNaN(n) || n < 1 || n > 100) throw new BadRequestError('limit must be 1–100');
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
    const trimmed = q?.trim() ?? '';
    if (trimmed.length < MIN_QUERY_LENGTH) {
      throw new BadRequestError(`q must be at least ${MIN_QUERY_LENGTH} characters`);
    }
    return this.searchService.search({
      query: trimmed,
      status,
      cursor,
      limit: parseLimit(limit),
    });
  }
}
