// @csv-mode
import { Injectable, Logger } from '@nestjs/common';
import { AqConsumer } from '../aq-consumer.interface';
import { WorkflowTransitionEvent } from '../event-types';
import { NotificationService } from '../../notifications/notification.service';

@Injectable()
export class WorkflowTransitionConsumer implements AqConsumer {
  readonly topic = 'workflow.transition';
  private readonly logger = new Logger(WorkflowTransitionConsumer.name);

  constructor(private readonly notifications: NotificationService) {}

  async handle(_subject: string, payload: string): Promise<void> {
    const event = JSON.parse(payload) as WorkflowTransitionEvent;
    this.logger.log(
      `Workflow transition: page=${event.pageId} ${event.from} → ${event.to} by actor=${event.actorId}`,
    );
    await this.notifications.onWorkflowTransition(event);
  }
}
