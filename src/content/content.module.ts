import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
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
  ],
  exports: [ContentService, WorkflowService],
})
export class ContentModule {}
