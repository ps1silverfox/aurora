// @csv-mode
import { Injectable, Logger } from '@nestjs/common';
import { VariantService } from '../../media/variant.service';
import { AqConsumer } from '../aq-consumer.interface';
import { MediaUploadedEvent } from '../event-types';

@Injectable()
export class MediaUploadedConsumer implements AqConsumer {
  readonly topic = 'media.uploaded';
  private readonly logger = new Logger(MediaUploadedConsumer.name);

  constructor(private readonly variants: VariantService) {}

  async handle(_subject: string, payload: string): Promise<void> {
    const event = JSON.parse(payload) as MediaUploadedEvent;
    await this.variants.generateVariants(event.id, event.filename, event.mimeType);
    this.logger.debug(`Generated variants for media ${event.id}`);
  }
}
