import { Module } from '@nestjs/common';
import { TaxonomyService } from './taxonomy.service';
import { CategoriesController, TagsController, PageTaxonomyController } from './taxonomy.controller';

@Module({
  controllers: [CategoriesController, TagsController, PageTaxonomyController],
  providers: [TaxonomyService],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
