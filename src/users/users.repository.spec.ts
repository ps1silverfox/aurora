import { Test } from '@nestjs/testing';
import { UsersRepository } from './users.repository';
import { DB_SERVICE } from '../db/db.interface';

const mockDb = {
  query: jest.fn(),
  execute: jest.fn(),
  executeBatch: jest.fn(),
  executeOut: jest.fn().mockResolvedValue({}),
};

const RAW_ID = 'AABBCCDD11223344AABBCCDD11223344';
const UUID_ID = 'aabbccdd-1122-3344-aabb-ccdd11223344';

const userRow = {
  ID: RAW_ID,
  KEYCLOAK_ID: 'kc-sub-123',
  EMAIL: 'alice@example.com',
  NAME: 'Alice',
  ROLE_ID: 2,
  CREATED_AT: new Date('2024-01-01T00:00:00Z'),
  UPDATED_AT: new Date('2024-01-01T00:00:00Z'),
  DELETED_AT: null,
  ROLE_NAME: 'Admin',
  ROLE_PERMISSIONS: '["admin.*"]',
  ROLE_CREATED_AT: new Date('2024-01-01T00:00:00Z'),
};

describe('UsersRepository', () => {
  let repo: UsersRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        UsersRepository,
        { provide: DB_SERVICE, useValue: mockDb },
      ],
    }).compile();
    repo = module.get(UsersRepository);
  });

  describe('findById', () => {
    it('returns mapped user when row exists', async () => {
      mockDb.query.mockResolvedValueOnce([userRow]);
      const user = await repo.findById(UUID_ID);
      expect(user).not.toBeNull();
      if (user == null) return;
      expect(user.id).toBe(UUID_ID);
      expect(user.email).toBe('alice@example.com');
      expect(user.role?.name).toBe('Admin');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('HEXTORAW'),
        expect.objectContaining({ id: RAW_ID }),
      );
    });

    it('returns null when no row found', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      expect(await repo.findById(UUID_ID)).toBeNull();
    });
  });

  describe('findByKeycloakId', () => {
    it('returns user by keycloak id', async () => {
      mockDb.query.mockResolvedValueOnce([userRow]);
      const user = await repo.findByKeycloakId('kc-sub-123');
      expect(user).not.toBeNull();
      if (user == null) return;
      expect(user.keycloakId).toBe('kc-sub-123');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('KEYCLOAK_ID'),
        expect.objectContaining({ keycloakId: 'kc-sub-123' }),
      );
    });
  });

  describe('create', () => {
    it('inserts and returns new user', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.query.mockResolvedValueOnce([userRow]);
      const user = await repo.create({
        keycloakId: 'kc-sub-123',
        email: 'alice@example.com',
        name: 'Alice',
      });
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO USERS'),
        expect.objectContaining({ keycloakId: 'kc-sub-123', email: 'alice@example.com' }),
      );
      expect(user.id).toBe(UUID_ID);
    });
  });

  describe('softDelete', () => {
    // TODO: implement — verify execute called with UPDATE USERS SET DELETED_AT and correct id bind
    it('calls execute with DELETED_AT update', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      await repo.softDelete(UUID_ID);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETED_AT'),
        expect.objectContaining({ id: RAW_ID }),
      );
    });
  });

  describe('update', () => {
    // TODO: implement — verify dynamic SET clause: only provided fields appear in SQL
    it('includes only provided fields in SET clause', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.query.mockResolvedValueOnce([userRow]);
      await repo.update(UUID_ID, { name: 'Bob' });
      const [sql, binds] = mockDb.execute.mock.calls[0] as [string, Record<string, unknown>];
      expect(sql).toContain('NAME = :name');
      expect(sql).not.toContain(':email');
      expect(sql).not.toContain(':roleId');
      expect(binds['name']).toBe('Bob');
    });

    it('omits update when no fields provided', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.query.mockResolvedValueOnce([userRow]);
      await repo.update(UUID_ID, {});
      const [sql] = mockDb.execute.mock.calls[0] as [string, unknown];
      // Only UPDATED_AT = SYSTIMESTAMP should be in SET
      expect(sql).toContain('UPDATED_AT = SYSTIMESTAMP');
      expect(sql).not.toContain(':email');
    });
  });

  describe('list', () => {
    it('returns page without cursor', async () => {
      mockDb.query.mockResolvedValueOnce([userRow]);
      const page = await repo.list(null, 10);
      expect(page.data).toHaveLength(1);
      expect(page.nextCursor).toBeNull();
    });

    it('sets nextCursor when more rows available', async () => {
      const rows = Array.from({ length: 11 }, () => ({ ...userRow }));
      mockDb.query.mockResolvedValueOnce(rows);
      const page = await repo.list(null, 10);
      expect(page.data).toHaveLength(10);
      expect(page.nextCursor).not.toBeNull();
    });

    it('caps page size at 100', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await repo.list(null, 9999);
      const [, binds] = mockDb.query.mock.calls[0] as [string, Record<string, unknown>];
      expect(binds['pageSize']).toBe(101); // 100 + 1 for hasNext check
    });
  });
});
