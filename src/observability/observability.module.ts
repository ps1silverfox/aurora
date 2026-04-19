import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppLoggerService } from './logger.service';
import { LoggingInterceptor } from './logging.interceptor';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  providers: [
    AppLoggerService,
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
  exports: [AppLoggerService, MetricsService],
})
export class ObservabilityModule {}
