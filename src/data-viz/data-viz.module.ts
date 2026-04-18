import { Module } from '@nestjs/common';
import { DataSourceService } from './data-source.service';
import { QueryEngineService } from './query-engine.service';
import { DataQueryController } from './data-query.controller';
import { AnalyticsController } from './analytics.controller';

@Module({
  controllers: [DataQueryController, AnalyticsController],
  providers: [DataSourceService, QueryEngineService],
  exports: [DataSourceService, QueryEngineService],
})
export class DataVizModule {}
