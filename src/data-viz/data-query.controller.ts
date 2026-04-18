import { Controller, Post, Get, Param, Body, Query, Res, HttpCode } from '@nestjs/common';
import type { Response } from 'express';
import { QueryEngineService } from './query-engine.service';
import { QueryConfig } from './drivers/driver.interface';

@Controller('api/v1/data-queries')
export class DataQueryController {
  constructor(private readonly queryEngine: QueryEngineService) {}

  @Post('execute')
  @HttpCode(200)
  async execute(
    @Body() body: { sourceId: string; query: QueryConfig; cacheTtl?: number },
  ) {
    return this.queryEngine.execute(body.sourceId, body.query, body.cacheTtl);
  }

  @Get(':id/export')
  async export(
    @Param('id') id: string,
    @Query() queryParams: QueryConfig,
    @Res() res: Response,
  ) {
    const csv = await this.queryEngine.exportCsv(id, queryParams);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="query-${id}.csv"`);
    res.send(csv);
  }
}
