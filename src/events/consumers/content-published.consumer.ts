// @csv-mode
import { Injectable, Logger } from '@nestjs/common';
import { SearchService } from '../../search/search.service';
import { AqConsumer } from '../aq-consumer.interface';
import { ContentCreatedEvent } from '../event-types';

@Injectable()
export class ContentPublishedConsumer implements AqConsumer {
  readonly topic = 'content.created';
  private readonly logger = new Logger(ContentPublishedConsumer.name);

  constructor(private readonly search: SearchService) {}

  async handle(_subject: string, payload: string): Promise<void> {
    const event = JSON.parse(payload) as ContentCreatedEvent;
    await this.search.index(event.id);
    this.logger.debug(`Indexed page ${event.id} after publish`);
  }
}
