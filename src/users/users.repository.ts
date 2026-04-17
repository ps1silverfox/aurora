import { Inject, Injectable } from '@nestjs/common';
import { DB_SERVICE, IDbService } from '../db/db.interface';
import { encodeCursor, decodeCursor, CursorPage } from '../common/pagination';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';

// Oracle RAW(16) comes back as 32-char uppercase hex — convert to UUID format
function rawToUuid(hex: string): string {
  const h = hex.replace(/-/g, '').toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function uuidToRaw(uuid: string): string {
  return uuid.replace(/-/g, '').toUpperCase();
}

interface UserRow {
  ID: string;
  KEYCLOAK_ID: string;
  EMAIL: string;
  NAME: string;
  ROLE_ID: number | null;
  CREATED_AT: Date;
  UPDATED_AT: Date;
  DELETED_AT: Date | null;
  ROLE_NAME?: string;
  ROLE_PERMISSIONS?: string;
  ROLE_CREATED_AT?: Date;
}

interface RoleRow {
  ID: number;
  NAME: string;
  PERMISSIONS: string | null;
  CREATED_AT: Date;
}

function mapUser(row: UserRow): User {
  const user: User = {
    id: rawToUuid(row.ID),
    keycloakId: row.KEYCLOAK_ID,
    email: row.EMAIL,
    name: row.NAME,
    roleId: row.ROLE_ID ?? null,
    createdAt: row.CREATED_AT,
    updatedAt: row.UPDATED_AT,
    deletedAt: row.DELETED_AT ?? null,
  };
  if (row.ROLE_NAME != null) {
    user.role = {
      id: row.ROLE_ID as number,
      name: row.ROLE_NAME,
      permissions: JSON.parse(row.ROLE_PERMISSIONS ?? '[]') as string[],
      createdAt: row.ROLE_CREATED_AT as Date,
    };
  }
  return user;
}

@Injectable()
export class UsersRepository {
  constructor(@Inject(DB_SERVICE) private readonly db: IDbService) {}

  async findById(id: string): Promise<User | null> {
    const rows = await this.db.query<UserRow>(
      `SELECT u.ID, u.KEYCLOAK_ID, u.EMAIL, u.NAME, u.ROLE_ID,
              u.CREATED_AT, u.UPDATED_AT, u.DELETED_AT,
              r.NAME AS ROLE_NAME, r.PERMISSIONS AS ROLE_PERMISSIONS, r.CREATED_AT AS ROLE_CREATED_AT
       FROM USERS u
       LEFT JOIN ROLES r ON r.ID = u.ROLE_ID
       WHERE u.ID = HEXTORAW(:id) AND u.DELETED_AT IS NULL`,
      { id: uuidToRaw(id) },
    );
    const row = rows[0];
    return row != null ? mapUser(row) : null;
  }

  async findByKeycloakId(keycloakId: string): Promise<User | null> {
    const rows = await this.db.query<UserRow>(
      `SELECT u.ID, u.KEYCLOAK_ID, u.EMAIL, u.NAME, u.ROLE_ID,
              u.CREATED_AT, u.UPDATED_AT, u.DELETED_AT,
              r.NAME AS ROLE_NAME, r.PERMISSIONS AS ROLE_PERMISSIONS, r.CREATED_AT AS ROLE_CREATED_AT
       FROM USERS u
       LEFT JOIN ROLES r ON r.ID = u.ROLE_ID
       WHERE u.KEYCLOAK_ID = :keycloakId AND u.DELETED_AT IS NULL`,
      { keycloakId },
    );
    const row = rows[0];
    return row != null ? mapUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db.query<UserRow>(
      `SELECT u.ID, u.KEYCLOAK_ID, u.EMAIL, u.NAME, u.ROLE_ID,
              u.CREATED_AT, u.UPDATED_AT, u.DELETED_AT
       FROM USERS u
       WHERE u.EMAIL = :email AND u.DELETED_AT IS NULL`,
      { email },
    );
    const row = rows[0];
    return row != null ? mapUser(row) : null;
  }

  async create(data: {
    keycloakId: string;
    email: string;
    name: string;
    roleId?: number;
  }): Promise<User> {
    await this.db.execute(
      `INSERT INTO USERS (KEYCLOAK_ID, EMAIL, NAME, ROLE_ID)
       VALUES (:keycloakId, :email, :name, :roleId)`,
      {
        keycloakId: data.keycloakId,
        email: data.email,
        name: data.name,
        roleId: data.roleId ?? null,
      },
    );
    const user = await this.findByKeycloakId(data.keycloakId);
    if (!user) throw new Error('User insert failed');
    return user;
  }

  async update(
    id: string,
    data: Partial<Pick<User, 'email' | 'name' | 'roleId'>>,
  ): Promise<User | null> {
    const setClauses: string[] = ['UPDATED_AT = SYSTIMESTAMP'];
    const binds: Record<string, unknown> = { id: uuidToRaw(id) };

    if (data.email !== undefined) {
      setClauses.push('EMAIL = :email');
      binds['email'] = data.email;
    }
    if (data.name !== undefined) {
      setClauses.push('NAME = :name');
      binds['name'] = data.name;
    }
    if (data.roleId !== undefined) {
      setClauses.push('ROLE_ID = :roleId');
      binds['roleId'] = data.roleId;
    }

    await this.db.execute(
      `UPDATE USERS SET ${setClauses.join(', ')} WHERE ID = HEXTORAW(:id) AND DELETED_AT IS NULL`,
      binds,
    );
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.db.execute(
      `UPDATE USERS SET DELETED_AT = SYSTIMESTAMP WHERE ID = HEXTORAW(:id) AND DELETED_AT IS NULL`,
      { id: uuidToRaw(id) },
    );
  }

  async list(
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<User>> {
    const pageSize = Math.min(limit, 100);
    const binds: Record<string, unknown> = { pageSize: pageSize + 1 };
    let whereClause = 'WHERE u.DELETED_AT IS NULL';

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded != null && decoded['createdAt'] != null && decoded['id'] != null) {
        whereClause +=
          ` AND (u.CREATED_AT > TIMESTAMP :afterTs` +
          ` OR (u.CREATED_AT = TIMESTAMP :afterTs AND RAWTOHEX(u.ID) > :afterId))`;
        binds['afterTs'] = decoded['createdAt'];
        binds['afterId'] = (decoded['id'] as string).toUpperCase();
      }
    }

    const rows = await this.db.query<UserRow>(
      `SELECT u.ID, u.KEYCLOAK_ID, u.EMAIL, u.NAME, u.ROLE_ID,
              u.CREATED_AT, u.UPDATED_AT, u.DELETED_AT
       FROM USERS u
       ${whereClause}
       ORDER BY u.CREATED_AT ASC, u.ID ASC
       FETCH FIRST :pageSize ROWS ONLY`,
      binds,
    );

    const hasNext = rows.length > pageSize;
    const data = rows.slice(0, pageSize).map(mapUser);
    const last = data[data.length - 1];
    const nextCursor =
      hasNext && last != null
        ? encodeCursor({ createdAt: last.createdAt, id: uuidToRaw(last.id) })
        : null;

    return { data, nextCursor, prevCursor: null };
  }

  async findRoleById(roleId: number): Promise<Role | null> {
    const rows = await this.db.query<RoleRow>(
      `SELECT ID, NAME, PERMISSIONS, CREATED_AT FROM ROLES WHERE ID = :id`,
      { id: roleId },
    );
    const r = rows[0];
    if (r == null) return null;
    return {
      id: r.ID,
      name: r.NAME,
      permissions: JSON.parse(r.PERMISSIONS ?? '[]') as string[],
      createdAt: r.CREATED_AT,
    };
  }
}
