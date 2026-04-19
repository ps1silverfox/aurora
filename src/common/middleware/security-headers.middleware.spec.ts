import { SecurityHeadersMiddleware } from './security-headers.middleware';
import { Request, Response } from 'express';

describe('SecurityHeadersMiddleware', () => {
  let middleware: SecurityHeadersMiddleware;
  let headers: Record<string, string>;
  let mockRes: Partial<Response>;
  let nextCalled: boolean;

  beforeEach(() => {
    middleware = new SecurityHeadersMiddleware();
    headers = {};
    nextCalled = false;
    mockRes = {
      setHeader: (key: string, value: string) => {
        headers[key] = value;
        return mockRes as Response;
      },
    };
  });

  it('sets Content-Security-Policy', () => {
    middleware.use({} as Request, mockRes as Response, () => { nextCalled = true; });
    expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
  });

  it('sets X-Frame-Options to DENY', () => {
    middleware.use({} as Request, mockRes as Response, () => { nextCalled = true; });
    expect(headers['X-Frame-Options']).toBe('DENY');
  });

  it('sets X-Content-Type-Options to nosniff', () => {
    middleware.use({} as Request, mockRes as Response, () => { nextCalled = true; });
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('sets HSTS header', () => {
    middleware.use({} as Request, mockRes as Response, () => { nextCalled = true; });
    expect(headers['Strict-Transport-Security']).toContain('max-age=');
  });

  it('sets Referrer-Policy', () => {
    middleware.use({} as Request, mockRes as Response, () => { nextCalled = true; });
    expect(headers['Referrer-Policy']).toBeDefined();
  });

  it('calls next()', () => {
    middleware.use({} as Request, mockRes as Response, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });
});
