import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  TaxonomyService,
  Category,
  Tag,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateTagDto,
  UpdateTagDto,
} from './taxonomy.service';

@Controller('api/v1/categories')
export class CategoriesController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Get()
  listCategories(): Promise<Category[]> {
    return this.taxonomy.listCategories();
  }

  @Get(':id')
  getCategory(@Param('id', ParseIntPipe) id: number): Promise<Category> {
    return this.taxonomy.getCategory(id);
  }

  @Post()
  createCategory(@Body() dto: CreateCategoryDto): Promise<Category> {
    return this.taxonomy.createCategory(dto);
  }

  @Put(':id')
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.taxonomy.updateCategory(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.taxonomy.deleteCategory(id);
  }
}

@Controller('api/v1/tags')
export class TagsController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Get()
  listTags(): Promise<Tag[]> {
    return this.taxonomy.listTags();
  }

  @Get(':id')
  getTag(@Param('id', ParseIntPipe) id: number): Promise<Tag> {
    return this.taxonomy.getTag(id);
  }

  @Post()
  createTag(@Body() dto: CreateTagDto): Promise<Tag> {
    return this.taxonomy.createTag(dto);
  }

  @Put(':id')
  updateTag(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTagDto): Promise<Tag> {
    return this.taxonomy.updateTag(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTag(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.taxonomy.deleteTag(id);
  }
}

@Controller('api/v1/pages')
export class PageTaxonomyController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Get(':pageId/categories')
  getPageCategories(@Param('pageId') pageId: string): Promise<Category[]> {
    return this.taxonomy.getPageCategories(pageId);
  }

  @Post(':pageId/categories/:categoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async attachCategory(
    @Param('pageId') pageId: string,
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ): Promise<void> {
    await this.taxonomy.attachCategory(pageId, categoryId);
  }

  @Delete(':pageId/categories/:categoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async detachCategory(
    @Param('pageId') pageId: string,
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ): Promise<void> {
    await this.taxonomy.detachCategory(pageId, categoryId);
  }

  @Get(':pageId/tags')
  getPageTags(@Param('pageId') pageId: string): Promise<Tag[]> {
    return this.taxonomy.getPageTags(pageId);
  }

  @Post(':pageId/tags/:tagId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async attachTag(
    @Param('pageId') pageId: string,
    @Param('tagId', ParseIntPipe) tagId: number,
  ): Promise<void> {
    await this.taxonomy.attachTag(pageId, tagId);
  }

  @Delete(':pageId/tags/:tagId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async detachTag(
    @Param('pageId') pageId: string,
    @Param('tagId', ParseIntPipe) tagId: number,
  ): Promise<void> {
    await this.taxonomy.detachTag(pageId, tagId);
  }
}
