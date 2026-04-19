import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';
import { AppLoggerService } from './logger.service';

function makeContext(overrides: {
  method?: string;
  path?: string;
  userId?: string;
  existingRequestId?: string;
}): ExecutionContext {
  const req = {
    method: overrides.method ?? 'GET',
    path: overrides.path ?? '/api/v1/pages',
    headers: {} as Record<string, string>,
    user: overrides.userId ? { id: overrides.userId } : undefined,
  };
  if (overrides.existingRequestId) {
    req.headers['x-request-id'] = overrides.existingRequestId;
  }
  const res = { statusCode: 200 };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

function makeHandler(value: unknown = {}): CallHandler {
  return { handle: () => of(value) };
}

function makeErrorHandler(err: unknown): CallHandler {
  return { handle: () => throwError(() => err) };
}

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    const logger = new AppLoggerService();
    logSpy = jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    interceptor = new LoggingInterceptor(logger);
  });

  it('logs a successful request with request_id, method, path, status, user_id', (done) => {
    const ctx = makeContext({ method: 'GET', path: '/api/v1/pages', userId: 'user-123' });
    interceptor.intercept(ctx, makeHandler()).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledTimes(1);
        const [msg, fields] = logSpy.mock.calls[0] as [string, Record<string, unknown>];
        expect(msg).toBe('HTTP request');
        expect(typeof fields['request_id']).toBe('string');
        expect(fields['method']).toBe('GET');
        expect(fields['path']).toBe('/api/v1/pages');
        expect(fields['status']).toBe(200);
        expect(fields['user_id']).toBe('user-123');
        expect(typeof fields['duration_ms']).toBe('number');
        done();
      },
    });
  });

  it('sets x-request-id header on the request', (done) => {
    const ctx = makeContext({});
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    interceptor.intercept(ctx, makeHandler()).subscribe({
      complete: () => {
        expect(typeof req.headers['x-request-id']).toBe('string');
        expect((req.headers['x-request-id'] ?? '').length).toBeGreaterThan(0);
        done();
      },
    });
  });

  it('logs null user_id when request has no authenticated user', (done) => {
    const ctx = makeContext({ userId: undefined });
    interceptor.intercept(ctx, makeHandler()).subscribe({
      complete: () => {
        const [, fields] = logSpy.mock.calls[0] as [string, Record<string, unknown>];
        expect(fields['user_id']).toBeNull();
        done();
      },
    });
  });

  it('logs error with status 500 on untyped exception', (done) => {
    const ctx = makeContext({});
    interceptor.intercept(ctx, makeErrorHandler(new Error('boom'))).subscribe({
      error: () => {
        expect(errorSpy).toHaveBeenCalledTimes(1);
        const [msg, , fields] = errorSpy.mock.calls[0] as [
          string,
          string | undefined,
          Record<string, unknown>,
        ];
        expect(msg).toBe('HTTP request error');
        expect(fields['status']).toBe(500);
        done();
      },
    });
  });

  it('logs error with the exception status property when present', (done) => {
    const ctx = makeContext({});
    const err = { status: 404, message: 'Not Found' };
    interceptor.intercept(ctx, makeErrorHandler(err)).subscribe({
      error: () => {
        const [, , fields] = errorSpy.mock.calls[0] as [
          string,
          string | undefined,
          Record<string, unknown>,
        ];
        expect(fields['status']).toBe(404);
        done();
      },
    });
  });

  it('includes request_id in the error log', (done) => {
    const ctx = makeContext({});
    interceptor.intercept(ctx, makeErrorHandler(new Error('x'))).subscribe({
      error: () => {
        const [, , fields] = errorSpy.mock.calls[0] as [
          string,
          string | undefined,
          Record<string, unknown>,
        ];
        expect(typeof fields['request_id']).toBe('string');
        done();
      },
    });
  });
});
