import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  HttpCode,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MediaService } from './media.service';
import { VariantJob } from './variant.job';
import { RolesGuard } from '../users/roles.guard';
import { Roles } from '../users/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types';
import { ValidationError } from '../common/errors';

function parseLimit(raw: string | undefined): number {
  const n = raw != null ? parseInt(raw, 10) : 20;
  if (isNaN(n) || n < 1 || n > 100) throw new ValidationError('limit must be 1–100');
  return n;
}

@Controller('api/v1/media')
@UseGuards(RolesGuard)
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly variantJob: VariantJob,
  ) {}

  @Post()
  @Roles('media.upload')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('No file provided');

    const media = await this.mediaService.upload(
      {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
      actor.id,
    );

    void this.variantJob.run(media.id, media.storagePath, media.mimeType ?? '');

    return media;
  }

  @Get()
  @Roles('media.read')
  async list(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.mediaService.list(cursor, parseLimit(limit));
  }

  @Get(':id')
  @Roles('media.read')
  async findOne(@Param('id') id: string) {
    return this.mediaService.findById(id);
  }

  @Delete(':id')
  @Roles('media.delete')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    await this.mediaService.delete(id, actor.id);
  }
}
