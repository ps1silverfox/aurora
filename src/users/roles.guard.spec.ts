import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { RolesService } from './roles.service';
import { ROLES_KEY } from './roles.decorator';
import { AuthenticatedUser } from '../auth/types';

const makeContext = (user: AuthenticatedUser | undefined): ExecutionContext =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let rolesService: { can: jest.Mock };

  beforeEach(() => {
    reflector = new Reflector();
    rolesService = { can: jest.fn() };
    guard = new RolesGuard(reflector, rolesService as unknown as RolesService);
  });

  it('allows when no @Roles() decorator', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext(undefined))).toBe(true);
  });

  it('denies when user is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['content.write']);
    expect(guard.canActivate(makeContext(undefined))).toBe(false);
  });

  it('grants when user has required permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['content.write']);
    rolesService.can.mockReturnValue(true);
    const user: AuthenticatedUser = { id: 'u1', email: 'a@b.com', name: 'A', roles: ['content.write'] };
    expect(guard.canActivate(makeContext(user))).toBe(true);
  });

  it('denies when user lacks required permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['users.roles.assign']);
    rolesService.can.mockReturnValue(false);
    const user: AuthenticatedUser = { id: 'u1', email: 'a@b.com', name: 'A', roles: ['content.write'] };
    expect(guard.canActivate(makeContext(user))).toBe(false);
  });

  it('requires ALL permissions when multiple specified', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([ROLES_KEY, ['perm.a', 'perm.b']]);
    rolesService.can.mockReturnValueOnce(true).mockReturnValueOnce(false);
    const user: AuthenticatedUser = { id: 'u1', email: 'a@b.com', name: 'A', roles: ['perm.a'] };
    // With metadata returning the key/value pair format, guard reads permissions
    // Simplified: test that can() is called for each permission
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['perm.a', 'perm.b']);
    expect(guard.canActivate(makeContext(user))).toBe(false);
  });
});
