import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  UseGuards,
  UsePipes,
  ValidationPipe,
  NotFoundException,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import { BlockTemplatesService } from './block-templates.service';
import { RolesGuard } from '../users/roles.guard';
import { Roles } from '../users/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types';
import { NotFoundError } from '../common/errors';

export class CreateBlockTemplateDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() blockType!: string;
  @IsObject() content!: Record<string, unknown>;
}

@Controller('api/v1/block-templates')
@UseGuards(RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class BlockTemplatesController {
  constructor(private readonly service: BlockTemplatesService) {}

  @Get()
  @Roles('content.templates.read')
  async list() {
    return this.service.list();
  }

  @Post()
  @Roles('content.templates.create')
  @HttpCode(201)
  async create(@Body() dto: CreateBlockTemplateDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.create({ name: dto.name, blockType: dto.blockType, content: dto.content }, actor.id);
  }

  @Delete(':id')
  @Roles('content.templates.delete')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    try {
      await this.service.delete(id);
    } catch (err) {
      if (err instanceof NotFoundError) throw new NotFoundException(err.message);
      throw err;
    }
  }
}
