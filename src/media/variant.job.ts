import { Injectable, Logger } from '@nestjs/common';
import { VariantService } from './variant.service';
import { MediaVariant } from './entities/media.entity';

@Injectable()
export class VariantJob {
  private readonly logger = new Logger(VariantJob.name);

  constructor(private readonly variantService: VariantService) {}

  async run(mediaId: string, sourcePath: string, mimeType: string): Promise<MediaVariant[]> {
    try {
      return await this.variantService.generateVariants(mediaId, sourcePath, mimeType);
    } catch (err) {
      this.logger.error(
        `Variant generation failed for media ${mediaId} (${sourcePath}): ${String(err)}`,
      );
      return [];
    }
  }
}
