import { ExecutionContext } from '@nestjs/common';
import { CURRENT_USER_FACTORY } from './current-user.decorator';

function makeCtx(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('CurrentUser decorator factory', () => {
  it('returns the user object from request', () => {
    const user = { id: 'u1', roles: ['editor'] };
    expect(CURRENT_USER_FACTORY(undefined, makeCtx(user))).toEqual(user);
  });

  it('returns undefined when request has no user', () => {
    expect(CURRENT_USER_FACTORY(undefined, makeCtx(undefined))).toBeUndefined();
  });
});
