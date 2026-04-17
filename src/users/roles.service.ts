import { Inject, Injectable } from '@nestjs/common';
import { DB_SERVICE, IDbService } from '../db/db.interface';
import { Role } from './entities/role.entity';
import { NotFoundError, ConflictError } from '../common/errors';
import { AuthenticatedUser } from '../auth/types';

interface RoleRow {
  ID: number;
  NAME: string;
  PERMISSIONS: string | null;
  CREATED_AT: Date;
}

function mapRole(row: RoleRow): Role {
  return {
    id: row.ID,
    name: row.NAME,
    permissions: JSON.parse(row.PERMISSIONS ?? '[]') as string[],
    createdAt: row.CREATED_AT,
  };
}

export interface CreateRoleDto {
  name: string;
  permissions: string[];
}

export interface UpdateRoleDto {
  name?: string;
  permissions?: string[];
}

@Injectable()
export class RolesService {
  constructor(@Inject(DB_SERVICE) private readonly db: IDbService) {}

  async listRoles(): Promise<Role[]> {
    const rows = await this.db.query<RoleRow>(
      `SELECT ID, NAME, PERMISSIONS, CREATED_AT FROM ROLES ORDER BY NAME ASC`,
    );
    return rows.map(mapRole);
  }

  async createRole(dto: CreateRoleDto): Promise<Role> {
    const existing = await this.db.query<RoleRow>(
      `SELECT ID, NAME, PERMISSIONS, CREATED_AT FROM ROLES WHERE NAME = :name`,
      { name: dto.name },
    );
    if (existing.length > 0) throw new ConflictError(`Role '${dto.name}' already exists`);

    await this.db.execute(
      `INSERT INTO ROLES (NAME, PERMISSIONS) VALUES (:name, :permissions)`,
      { name: dto.name, permissions: JSON.stringify(dto.permissions) },
    );

    const rows = await this.db.query<RoleRow>(
      `SELECT ID, NAME, PERMISSIONS, CREATED_AT FROM ROLES WHERE NAME = :name`,
      { name: dto.name },
    );
    const row = rows[0];
    if (!row) throw new Error('Role insert failed');
    return mapRole(row);
  }

  async updateRole(id: number, dto: UpdateRoleDto): Promise<Role> {
    const existing = await this.db.query<RoleRow>(
      `SELECT ID, NAME, PERMISSIONS, CREATED_AT FROM ROLES WHERE ID = :id`,
      { id },
    );
    if (existing.length === 0) throw new NotFoundError(`Role ${id} not found`);

    const setClauses: string[] = [];
    const binds: Record<string, unknown> = { id };

    if (dto.name !== undefined) {
      setClauses.push('NAME = :name');
      binds['name'] = dto.name;
    }
    if (dto.permissions !== undefined) {
      setClauses.push('PERMISSIONS = :permissions');
      binds['permissions'] = JSON.stringify(dto.permissions);
    }

    if (setClauses.length > 0) {
      await this.db.execute(
        `UPDATE ROLES SET ${setClauses.join(', ')} WHERE ID = :id`,
        binds,
      );
    }

    const updated = await this.db.query<RoleRow>(
      `SELECT ID, NAME, PERMISSIONS, CREATED_AT FROM ROLES WHERE ID = :id`,
      { id },
    );
    const updatedRow = updated[0];
    if (!updatedRow) throw new Error(`Role ${id} missing after update`);
    return mapRole(updatedRow);
  }

  async deleteRole(id: number): Promise<void> {
    const existing = await this.db.query<RoleRow>(
      `SELECT ID FROM ROLES WHERE ID = :id`,
      { id },
    );
    if (existing.length === 0) throw new NotFoundError(`Role ${id} not found`);

    await this.db.execute(`DELETE FROM ROLES WHERE ID = :id`, { id });
  }

  can(user: AuthenticatedUser, permission: string): boolean {
    return user.roles.some((r) => r === permission || r === 'admin.*' || r.endsWith('.*') && permission.startsWith(r.slice(0, -2)));
  }
}
