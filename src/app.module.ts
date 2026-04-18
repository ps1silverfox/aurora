import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { ContentModule } from './content/content.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DbModule.forRoot(),
    AuthModule,
    UsersModule,
    AuditModule,
    ContentModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
