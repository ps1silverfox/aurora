import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { UsersModule } from '../users/users.module';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

@Module({
  imports: [DbModule, UsersModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
