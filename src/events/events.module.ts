import { Global, Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SearchModule } from '../search/search.module';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notification.module';
import { OracleAqService } from './oracle-aq.service';
import { EVENT_PUBLISHER } from './event-publisher.interface';
import { AQ_CONSUMERS, AqConsumer } from './aq-consumer.interface';
import { ConsumerSchedulerService } from './consumer-scheduler.service';
import { ContentPublishedConsumer } from './consumers/content-published.consumer';
import { ContentUpdatedConsumer } from './consumers/content-updated.consumer';
import { ContentDeletedConsumer } from './consumers/content-deleted.consumer';
import { MediaUploadedConsumer } from './consumers/media-uploaded.consumer';
import { WorkflowTransitionConsumer } from './consumers/workflow-transition.consumer';

@Global()
@Module({
  imports: [DbModule, SearchModule, MediaModule, NotificationsModule],
  providers: [
    OracleAqService,
    { provide: EVENT_PUBLISHER, useExisting: OracleAqService },
    ContentPublishedConsumer,
    ContentUpdatedConsumer,
    ContentDeletedConsumer,
    MediaUploadedConsumer,
    WorkflowTransitionConsumer,
    {
      provide: AQ_CONSUMERS,
      useFactory: (...consumers: AqConsumer[]) => consumers,
      inject: [
        ContentPublishedConsumer,
        ContentUpdatedConsumer,
        ContentDeletedConsumer,
        MediaUploadedConsumer,
        WorkflowTransitionConsumer,
      ],
    },
    ConsumerSchedulerService,
  ],
  exports: [OracleAqService, EVENT_PUBLISHER],
})
export class EventsModule {}
