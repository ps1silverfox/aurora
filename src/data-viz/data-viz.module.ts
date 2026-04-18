import { Module } from '@nestjs/common';
import { DataSourceService } from './data-source.service';
import { QueryEngineService } from './query-engine.service';
import { DataQueryController } from './data-query.controller';

@Module({
  controllers: [DataQueryController],
  providers: [DataSourceService, QueryEngineService],
  exports: [DataSourceService, QueryEngineService],
})
export class DataVizModule {}
