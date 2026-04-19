import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { UsersModule } from '../users/users.module';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';

@Module({
  imports: [DbModule, UsersModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
