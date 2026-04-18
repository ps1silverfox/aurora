import { Injectable } from '@nestjs/common';
import { VariantService } from './variant.service';
import { MediaVariant } from './entities/media.entity';

@Injectable()
export class VariantJob {
  constructor(private readonly variantService: VariantService) {}

  async run(mediaId: string, sourcePath: string, mimeType: string): Promise<MediaVariant[]> {
    return this.variantService.generateVariants(mediaId, sourcePath, mimeType);
  }
}
