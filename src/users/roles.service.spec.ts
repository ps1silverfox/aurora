import { Test } from '@nestjs/testing';
import { RolesService } from './roles.service';
import { DB_SERVICE } from '../db/db.interface';
import { NotFoundError, ConflictError } from '../common/errors';
import { AuthenticatedUser } from '../auth/types';

const mockDb = {
  query: jest.fn(),
  execute: jest.fn(),
  executeBatch: jest.fn(),
  executeOut: jest.fn().mockResolvedValue({}),
};

const roleRow = {
  ID: 1,
  NAME: 'Admin',
  PERMISSIONS: '["admin.*"]',
  CREATED_AT: new Date('2024-01-01'),
};

describe('RolesService', () => {
  let service: RolesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: DB_SERVICE, useValue: mockDb },
      ],
    }).compile();
    service = module.get(RolesService);
  });

  describe('listRoles', () => {
    it('returns mapped roles', async () => {
      mockDb.query.mockResolvedValue([roleRow]);
      const result = await service.listRoles();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 1, name: 'Admin', permissions: ['admin.*'] });
    });
  });

  describe('createRole', () => {
    it('creates and returns new role', async () => {
      mockDb.query
        .mockResolvedValueOnce([])   // check existing — empty
        .mockResolvedValueOnce([roleRow]); // re-fetch after insert
      await service.createRole({ name: 'Admin', permissions: ['admin.*'] });
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ROLES'),
        expect.objectContaining({ name: 'Admin' }),
      );
    });

    it('throws ConflictError when name taken', async () => {
      mockDb.query.mockResolvedValue([roleRow]);
      await expect(service.createRole({ name: 'Admin', permissions: [] })).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('updateRole', () => {
    it('updates name and permissions', async () => {
      mockDb.query
        .mockResolvedValueOnce([roleRow])   // exists check
        .mockResolvedValueOnce([{ ...roleRow, NAME: 'SuperAdmin' }]); // re-fetch
      const result = await service.updateRole(1, { name: 'SuperAdmin' });
      expect(mockDb.execute).toHaveBeenCalled();
      expect(result.name).toBe('SuperAdmin');
    });

    it('throws NotFoundError when role missing', async () => {
      mockDb.query.mockResolvedValue([]);
      await expect(service.updateRole(99, { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('deleteRole', () => {
    it('deletes existing role', async () => {
      mockDb.query.mockResolvedValue([roleRow]);
      await service.deleteRole(1);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM ROLES'),
        expect.objectContaining({ id: 1 }),
      );
    });

    it('throws NotFoundError when role missing', async () => {
      mockDb.query.mockResolvedValue([]);
      await expect(service.deleteRole(99)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('can', () => {
    const makeUser = (roles: string[]): AuthenticatedUser => ({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      roles,
    });

    it('grants exact permission match', () => {
      expect(service.can(makeUser(['content.write']), 'content.write')).toBe(true);
    });

    it('grants via admin.* wildcard', () => {
      expect(service.can(makeUser(['admin.*']), 'users.roles.assign')).toBe(true);
    });

    it('grants via namespace wildcard', () => {
      expect(service.can(makeUser(['content.*']), 'content.publish')).toBe(true);
    });

    it('denies when no matching permission', () => {
      expect(service.can(makeUser(['content.write']), 'users.roles.assign')).toBe(false);
    });

    it('denies when user has no roles', () => {
      expect(service.can(makeUser([]), 'content.write')).toBe(false);
    });
  });
});
