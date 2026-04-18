// @csv-mode
import { Injectable, Logger } from '@nestjs/common';
import { AqConsumer } from '../aq-consumer.interface';
import { WorkflowTransitionEvent } from '../event-types';

@Injectable()
export class WorkflowTransitionConsumer implements AqConsumer {
  readonly topic = 'workflow.transition';
  private readonly logger = new Logger(WorkflowTransitionConsumer.name);

  handle(_subject: string, payload: string): Promise<void> {
    const event = JSON.parse(payload) as WorkflowTransitionEvent;
    // Webhook/notification stub — full implementation in Phase 10
    this.logger.log(
      `Workflow transition: page=${event.pageId} ${event.from} → ${event.to} by actor=${event.actorId}`,
    );
    return Promise.resolve();
  }
}
