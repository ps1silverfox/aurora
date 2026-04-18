import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SearchService } from './search.service';

@Module({
  imports: [DbModule],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
