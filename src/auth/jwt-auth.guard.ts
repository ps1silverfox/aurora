import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';

// E2E_AUTH_BYPASS=true allows test suites to inject a mock user via X-Test-User-Id header.
// Never set this in production — NODE_ENV guard below makes it a no-op outside test/development.
const BYPASS_ENABLED =
  process.env['E2E_AUTH_BYPASS'] === 'true' && process.env['NODE_ENV'] !== 'production';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    if (BYPASS_ENABLED) {
      const req = context.switchToHttp().getRequest<Request>();
      const testUserId = req.headers['x-test-user-id'] as string | undefined;
      if (testUserId) {
        (req as Request & { user: unknown }).user = {
          id: testUserId,
          email: `${testUserId}@test.local`,
          name: 'Test User',
          roles: ['admin'],
        };
        return true;
      }
    }

    return super.canActivate(context);
  }
}
