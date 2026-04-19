import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { AppLoggerService } from './logger.service';

export interface AuthenticatedRequest extends Request {
  user?: { id?: string };
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<AuthenticatedRequest>();
    const res = http.getResponse<Response>();

    const requestId = randomUUID();
    const startedAt = Date.now();

    req.headers['x-request-id'] = requestId;

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log('HTTP request', {
            request_id: requestId,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration_ms: Date.now() - startedAt,
            user_id: req.user?.id ?? null,
          });
        },
        error: (err: unknown) => {
          const status =
            typeof err === 'object' && err !== null && 'status' in err
              ? (err as { status: number }).status
              : 500;
          this.logger.error('HTTP request error', undefined, {
            request_id: requestId,
            method: req.method,
            path: req.path,
            status,
            duration_ms: Date.now() - startedAt,
            user_id: req.user?.id ?? null,
          });
        },
      }),
    );
  }
}
