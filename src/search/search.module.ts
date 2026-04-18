import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';

@Module({
  imports: [DbModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
