import { Injectable, LoggerService } from '@nestjs/common';
import pino, { Logger } from 'pino';

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly logger: Logger;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL ?? 'info',
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  log(message: string, context?: Record<string, unknown>): void {
    this.logger.info({ context, ...context }, message);
  }

  error(message: string, trace?: string, context?: Record<string, unknown>): void {
    this.logger.error({ trace, context, ...context }, message);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.logger.warn({ context, ...context }, message);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.logger.debug({ context, ...context }, message);
  }

  verbose(message: string, context?: Record<string, unknown>): void {
    this.logger.trace({ context, ...context }, message);
  }

  child(bindings: Record<string, unknown>): Logger {
    return this.logger.child(bindings);
  }
}
