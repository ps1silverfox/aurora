// @csv-mode
import { Injectable, Logger } from '@nestjs/common';
import { SearchService } from '../../search/search.service';
import { AqConsumer } from '../aq-consumer.interface';
import { ContentUpdatedEvent } from '../event-types';

@Injectable()
export class ContentUpdatedConsumer implements AqConsumer {
  readonly topic = 'content.updated';
  private readonly logger = new Logger(ContentUpdatedConsumer.name);

  constructor(private readonly search: SearchService) {}

  async handle(_subject: string, payload: string): Promise<void> {
    const event = JSON.parse(payload) as ContentUpdatedEvent;
    await this.search.index(event.id);
    this.logger.debug(`Re-indexed page ${event.id} after update`);
  }
}
