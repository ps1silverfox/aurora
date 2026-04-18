import { Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DbModule } from '../db/db.module';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { EVENT_PUBLISHER } from '../events/event-publisher.interface';
import { ContentRepository } from './content.repository';
import { ContentService } from './content.service';
import { WorkflowService } from './workflow.service';
import { SchedulerService } from './scheduler.service';
import { ContentController } from './content.controller';
import { BlockTemplatesController } from './block-templates.controller';
import { BlockTemplatesService } from './block-templates.service';

@Module({
  imports: [DbModule, AuditModule, UsersModule],
  controllers: [ContentController, BlockTemplatesController],
  providers: [
    ContentRepository,
    ContentService,
    WorkflowService,
    SchedulerService,
    BlockTemplatesService,
    {
      provide: EVENT_PUBLISHER,
      useFactory: (emitter: EventEmitter2) => ({
        publish: (event: string, payload: unknown) => emitter.emit(event, payload),
      }),
      inject: [EventEmitter2],
    },
  ],
  exports: [ContentService, WorkflowService],
})
export class ContentModule {}
