import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { KeycloakJwtPayload } from '../auth/types';
import { User } from './entities/user.entity';
import { NotFoundError, ForbiddenError } from '../common/errors';
import { CursorPage } from '../common/pagination';

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  async syncFromToken(claims: KeycloakJwtPayload): Promise<User> {
    const existing = await this.repo.findByKeycloakId(claims.sub);
    if (existing) {
      const nameChanged = existing.name !== (claims.name ?? claims.preferred_username ?? claims.email);
      const emailChanged = existing.email !== claims.email;
      if (nameChanged || emailChanged) {
        const updated = await this.repo.update(existing.id, {
          email: claims.email,
          name: claims.name ?? claims.preferred_username ?? claims.email,
        });
        return updated ?? existing;
      }
      return existing;
    }
    return this.repo.create({
      keycloakId: claims.sub,
      email: claims.email,
      name: claims.name ?? claims.preferred_username ?? claims.email,
    });
  }

  async assignRole(actorId: string, targetUserId: string, roleId: number): Promise<User> {
    const actor = await this.repo.findById(actorId);
    if (!actor) throw new NotFoundError(`Actor user ${actorId} not found`);

    const hasPermission = actor.role?.permissions.some(
      (p) => p === 'users.roles.assign' || p === 'admin.*',
    ) ?? false;
    if (!hasPermission) throw new ForbiddenError('Insufficient permissions to assign roles');

    const role = await this.repo.findRoleById(roleId);
    if (!role) throw new NotFoundError(`Role ${roleId} not found`);

    const updated = await this.repo.update(targetUserId, { roleId });
    if (!updated) throw new NotFoundError(`Target user ${targetUserId} not found`);
    return updated;
  }

  async list(cursor: string | null, limit: number): Promise<CursorPage<User>> {
    return this.repo.list(cursor, Math.min(limit, 100));
  }

  async findById(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundError(`User ${id} not found`);
    return user;
  }
}
