import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { ContentModule } from './content/content.module';
import { MediaModule } from './media/media.module';
import { SearchModule } from './search/search.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DbModule.forRoot(),
    EventsModule,
    AuthModule,
    UsersModule,
    AuditModule,
    ContentModule,
    MediaModule,
    SearchModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
