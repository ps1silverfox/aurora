import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CURRENT_USER_FACTORY = (_data: unknown, ctx: ExecutionContext): unknown =>
  ctx.switchToHttp().getRequest<{ user?: unknown }>().user;

export const CurrentUser = createParamDecorator(CURRENT_USER_FACTORY);
