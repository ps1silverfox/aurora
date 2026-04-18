// @csv-mode — runs against mock DbService; no Oracle connection required
jest.setTimeout(15000); // NestJS module bootstrap takes ~3-5s on first run
import http from 'http';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { UsersModule } from '../../src/users/users.module';
import { AuditModule } from '../../src/audit/audit.module';
import { DbModule } from '../../src/db/db.module';
import { DB_SERVICE, IDbService } from '../../src/db/db.interface';
import { AuthenticatedUser } from '../../src/auth/types';
import { Request } from 'express';

interface UserBody {
  id: string;
  email: string;
  name: string;
  roleId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface PageBody<T> {
  data: T[];
  nextCursor: string | null;
  prevCursor: string | null;
}

interface AuditBody {
  id: string;
  action: string;
  entityType: string | null;
}

const ADMIN_USER: AuthenticatedUser = {
  id: 'aabbccdd-0011-2233-4455-66778899aabb',
  email: 'admin@example.com',
  name: 'Admin',
  roles: ['admin.*'],  // matches all admin.* permission checks in RolesService.can()
};

// Guard that bypasses JWT and injects a test user — isolates endpoint logic from auth
class FakeAuthGuard implements CanActivate {
  static user: AuthenticatedUser = ADMIN_USER;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    req.user = FakeAuthGuard.user;
    return true;
  }
}

const USER_ROW = {
  ID: 'AABBCCDD001122334455667788990011',
  KEYCLOAK_ID: 'kc-user-1',
  EMAIL: 'user@example.com',
  NAME: 'Test User',
  ROLE_ID: 1,
  CREATED_AT: new Date('2024-01-01T00:00:00Z'),
  UPDATED_AT: new Date('2024-01-01T00:00:00Z'),
  DELETED_AT: null,
  ROLE_NAME: 'Viewer',
  ROLE_PERMISSIONS: '["admin.users.read"]',
  ROLE_CREATED_AT: new Date('2024-01-01T00:00:00Z'),
};

const AUDIT_ROW = {
  ID: 'BBCCDDEE001122334455667788990011',
  ACTOR_ID: 'AABBCCDD001122334455667788990011',
  ACTION: 'user.role.assigned',
  ENTITY_TYPE: 'user',
  ENTITY_ID: 'some-id',
  DIFF: '{"roleId":1}',
  PREV_HASH: null,
  HASH: 'abc123',
  CREATED_AT: new Date('2024-01-02T00:00:00Z'),
};

function buildMockDb(queryResult: unknown[] = []): jest.Mocked<IDbService> {
  return {
    query: jest.fn().mockResolvedValue(queryResult),
    execute: jest.fn().mockResolvedValue(undefined),
    executeBatch: jest.fn().mockResolvedValue(undefined),
      executeOut: jest.fn().mockResolvedValue({}),
  };
}

async function createApp(mockDb: jest.Mocked<IDbService>): Promise<INestApplication> {
  // FakeAuthGuard is added as APP_GUARD provider (not override) because AuthModule
  // is not imported here — there is no existing APP_GUARD to override.
  const module: TestingModule = await Test.createTestingModule({
    imports: [DbModule.forRoot(), UsersModule, AuditModule],
    providers: [{ provide: APP_GUARD, useClass: FakeAuthGuard }],
  })
    .overrideProvider(DB_SERVICE)
    .useValue(mockDb)
    .compile();

  const app = module.createNestApplication();
  await app.init();
  return app;
}

function server(app: INestApplication): http.Server {
  return app.getHttpServer() as http.Server;
}

describe('UsersController (integration)', () => {
  let app: INestApplication | undefined;
  let mockDb: jest.Mocked<IDbService>;

  beforeEach(() => {
    FakeAuthGuard.user = ADMIN_USER;
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  describe('GET /api/v1/users', () => {
    it('returns paginated user list', async () => {
      mockDb = buildMockDb([USER_ROW]);
      app = await createApp(mockDb);

      const res = await request(server(app)).get('/api/v1/users');
      const body = res.body as PageBody<UserBody>;

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]?.email).toBe('user@example.com');
      expect(body.nextCursor).toBeNull();
    });

    it('returns empty list when no users', async () => {
      mockDb = buildMockDb([]);
      app = await createApp(mockDb);

      const res = await request(server(app)).get('/api/v1/users');
      const body = res.body as PageBody<UserBody>;

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(0);
    });

    it('rejects limit > 100', async () => {
      mockDb = buildMockDb([]);
      app = await createApp(mockDb);

      const res = await request(server(app)).get('/api/v1/users?limit=999');
      expect(res.status).toBe(422);
    });

    it('passes cursor to DB query', async () => {
      mockDb = buildMockDb([]);
      app = await createApp(mockDb);
      const cursor = Buffer.from(
        JSON.stringify({ createdAt: '2024-01-01T00:00:00.000Z', id: 'ABC' }),
      ).toString('base64url');

      await request(server(app)).get(`/api/v1/users?cursor=${cursor}`);

      const sql: string = (mockDb.query.mock.calls[0] as [string])[0];
      expect(sql).toMatch(/CREATED_AT/);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('returns single user', async () => {
      mockDb = buildMockDb([USER_ROW]);
      app = await createApp(mockDb);

      const res = await request(server(app)).get(
        '/api/v1/users/aabbccdd-0011-2233-4455-667788990011',
      );
      const body = res.body as UserBody;

      expect(res.status).toBe(200);
      expect(body.email).toBe('user@example.com');
    });

    it('returns 404 when user not found', async () => {
      mockDb = buildMockDb([]);
      app = await createApp(mockDb);

      const res = await request(server(app)).get(
        '/api/v1/users/00000000-0000-0000-0000-000000000000',
      );
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/users/:id/role', () => {
    it('assigns role and returns updated user', async () => {
      const adminRow = { ...USER_ROW, ROLE_PERMISSIONS: '["admin.*"]' };
      mockDb = {
        query: jest
          .fn()
          .mockResolvedValueOnce([adminRow])
          .mockResolvedValueOnce([
            { ID: 1, NAME: 'Admin', PERMISSIONS: '["admin.*"]', CREATED_AT: new Date() },
          ])
          .mockResolvedValueOnce([USER_ROW]),
        execute: jest.fn().mockResolvedValue(undefined),
        executeBatch: jest.fn().mockResolvedValue(undefined),
      executeOut: jest.fn().mockResolvedValue({}),
      };
      app = await createApp(mockDb);

      const res = await request(server(app))
        .put('/api/v1/users/aabbccdd-0011-2233-4455-667788990011/role')
        .send({ roleId: 1 });

      expect(res.status).toBe(200);
    });

    it('returns 400 on invalid body', async () => {
      mockDb = buildMockDb([]);
      app = await createApp(mockDb);

      const res = await request(server(app))
        .put('/api/v1/users/aabbccdd-0011-2233-4455-667788990011/role')
        .send({ roleId: 'not-a-number' });

      expect(res.status).toBe(400);
    });
  });
});

describe('AuditController (integration)', () => {
  let app: INestApplication | undefined;
  let mockDb: jest.Mocked<IDbService>;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  describe('GET /api/v1/audit-log', () => {
    it('returns paginated audit entries', async () => {
      mockDb = buildMockDb([AUDIT_ROW]);
      app = await createApp(mockDb);

      const res = await request(server(app)).get('/api/v1/audit-log');
      const body = res.body as PageBody<AuditBody>;

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]?.action).toBe('user.role.assigned');
      expect(body.nextCursor).toBeNull();
    });

    it('filters by entity_type', async () => {
      mockDb = buildMockDb([AUDIT_ROW]);
      app = await createApp(mockDb);

      await request(server(app)).get('/api/v1/audit-log?entity_type=user');

      const sql: string = (mockDb.query.mock.calls[0] as [string])[0];
      expect(sql).toMatch(/ENTITY_TYPE = :entityType/);
    });

    it('filters by actor_id', async () => {
      mockDb = buildMockDb([]);
      app = await createApp(mockDb);

      await request(server(app)).get(
        '/api/v1/audit-log?actor_id=aabbccdd-0011-2233-4455-667788990011',
      );

      const sql: string = (mockDb.query.mock.calls[0] as [string])[0];
      expect(sql).toMatch(/ACTOR_ID = HEXTORAW/);
    });

    it('rejects invalid from date', async () => {
      mockDb = buildMockDb([]);
      app = await createApp(mockDb);

      const res = await request(server(app)).get('/api/v1/audit-log?from=not-a-date');
      expect(res.status).toBe(422);
    });

    it('filters by date range', async () => {
      mockDb = buildMockDb([AUDIT_ROW]);
      app = await createApp(mockDb);

      await request(server(app)).get('/api/v1/audit-log?from=2024-01-01&to=2024-12-31');

      const sql: string = (mockDb.query.mock.calls[0] as [string])[0];
      expect(sql).toMatch(/CREATED_AT >= :fromDate/);
      expect(sql).toMatch(/CREATED_AT <= :toDate/);
    });

    it('returns empty list when no entries', async () => {
      mockDb = buildMockDb([]);
      app = await createApp(mockDb);

      const res = await request(server(app)).get('/api/v1/audit-log');
      const body = res.body as PageBody<AuditBody>;

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(0);
    });
  });
});
