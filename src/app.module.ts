import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DbModule } from './db/db.module';
import { ObservabilityModule } from './observability/observability.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { ContentModule } from './content/content.module';
import { MediaModule } from './media/media.module';
import { SearchModule } from './search/search.module';
import { EventsModule } from './events/events.module';
import { ThemesModule } from './themes/themes.module';
import { DataVizModule } from './data-viz/data-viz.module';
import { PluginsModule } from './plugins/plugins.module';
import { HookManagerModule } from './plugins/hook-manager.module';
import { NotificationsModule } from './notifications/notification.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 100 },
      { name: 'auth', ttl: 60000, limit: 10 },
    ]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ObservabilityModule,
    DbModule.forRoot(),
    EventsModule,
    AuthModule,
    UsersModule,
    AuditModule,
    ContentModule,
    MediaModule,
    SearchModule,
    ThemesModule,
    DataVizModule,
    HookManagerModule,
    PluginsModule,
    NotificationsModule,
    TaxonomyModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SecurityHeadersMiddleware).forRoutes('*');
  }
}
