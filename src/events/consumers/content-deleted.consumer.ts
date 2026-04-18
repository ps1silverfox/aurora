// @csv-mode
import { Injectable, Logger } from '@nestjs/common';
import { SearchService } from '../../search/search.service';
import { AqConsumer } from '../aq-consumer.interface';
import { ContentDeletedEvent } from '../event-types';

@Injectable()
export class ContentDeletedConsumer implements AqConsumer {
  readonly topic = 'content.deleted';
  private readonly logger = new Logger(ContentDeletedConsumer.name);

  constructor(private readonly search: SearchService) {}

  async handle(_subject: string, payload: string): Promise<void> {
    const event = JSON.parse(payload) as ContentDeletedEvent;
    await this.search.remove(event.id);
    this.logger.debug(`Removed search entry for page ${event.id}`);
  }
}
