import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { NotFoundError, ForbiddenError } from '../common/errors';
import { KeycloakJwtPayload } from '../auth/types';
import { User } from './entities/user.entity';

const mockRepo = {
  findByKeycloakId: jest.fn(),
  findById: jest.fn(),
  findRoleById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  list: jest.fn(),
};

const baseUser: User = {
  id: 'uuid-1',
  keycloakId: 'kc-sub-1',
  email: 'alice@example.com',
  name: 'Alice',
  roleId: 1,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
  role: {
    id: 1,
    name: 'Admin',
    permissions: ['admin.*'],
    createdAt: new Date('2024-01-01'),
  },
};

const claims: KeycloakJwtPayload = {
  sub: 'kc-sub-1',
  email: 'alice@example.com',
  name: 'Alice',
  iss: 'https://keycloak/realms/aurora',
  exp: 9999999999,
  iat: 1000000000,
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockRepo },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  describe('syncFromToken', () => {
    it('returns existing user when no fields changed', async () => {
      mockRepo.findByKeycloakId.mockResolvedValue(baseUser);
      const result = await service.syncFromToken(claims);
      expect(result).toBe(baseUser);
      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('creates user on first login', async () => {
      mockRepo.findByKeycloakId.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(baseUser);
      const result = await service.syncFromToken(claims);
      expect(mockRepo.create).toHaveBeenCalledWith({
        keycloakId: 'kc-sub-1',
        email: 'alice@example.com',
        name: 'Alice',
      });
      expect(result).toBe(baseUser);
    });

    it('updates user when email changes', async () => {
      const outdated = { ...baseUser, email: 'old@example.com' };
      const updated = { ...baseUser };
      mockRepo.findByKeycloakId.mockResolvedValue(outdated);
      mockRepo.update.mockResolvedValue(updated);
      const result = await service.syncFromToken(claims);
      expect(mockRepo.update).toHaveBeenCalledWith('uuid-1', {
        email: 'alice@example.com',
        name: 'Alice',
      });
      expect(result).toBe(updated);
    });

    it('falls back to preferred_username when name missing', async () => {
      const noName: KeycloakJwtPayload = { ...claims, name: undefined, preferred_username: 'alice_pref' };
      mockRepo.findByKeycloakId.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(baseUser);
      await service.syncFromToken(noName);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'alice_pref' }),
      );
    });
  });

  describe('assignRole', () => {
    const target: User = { ...baseUser, id: 'uuid-2', keycloakId: 'kc-sub-2', role: undefined, roleId: null };

    it('assigns role when actor has admin.* permission', async () => {
      mockRepo.findById
        .mockResolvedValueOnce(baseUser)
        .mockResolvedValueOnce(target);
      mockRepo.findRoleById.mockResolvedValue({ id: 1, name: 'Admin', permissions: ['admin.*'], createdAt: new Date() });
      mockRepo.update.mockResolvedValue({ ...target, roleId: 1 });

      const result = await service.assignRole('uuid-1', 'uuid-2', 1);
      expect(mockRepo.update).toHaveBeenCalledWith('uuid-2', { roleId: 1 });
      expect(result.roleId).toBe(1);
    });

    it('throws ForbiddenError when actor lacks permission', async () => {
      const noPerms: User = { ...baseUser, role: { id: 2, name: 'Editor', permissions: ['content.write'], createdAt: new Date() } };
      mockRepo.findById.mockResolvedValue(noPerms);
      await expect(service.assignRole('uuid-1', 'uuid-2', 1)).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('throws NotFoundError when actor not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.assignRole('uuid-x', 'uuid-2', 1)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws NotFoundError when role not found', async () => {
      mockRepo.findById.mockResolvedValue(baseUser);
      mockRepo.findRoleById.mockResolvedValue(null);
      await expect(service.assignRole('uuid-1', 'uuid-2', 99)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws NotFoundError when target user not found', async () => {
      mockRepo.findById.mockResolvedValue(baseUser);
      mockRepo.findRoleById.mockResolvedValue({ id: 1, name: 'Admin', permissions: ['admin.*'], createdAt: new Date() });
      mockRepo.update.mockResolvedValue(null);
      await expect(service.assignRole('uuid-1', 'uuid-missing', 1)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('findById', () => {
    it('returns user when found', async () => {
      mockRepo.findById.mockResolvedValue(baseUser);
      const result = await service.findById('uuid-1');
      expect(result).toBe(baseUser);
    });

    it('throws NotFoundError when user missing', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.findById('uuid-x')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('list', () => {
    it('delegates to repo with capped limit', async () => {
      const page = { data: [baseUser], nextCursor: null, prevCursor: null };
      mockRepo.list.mockResolvedValue(page);
      const result = await service.list(null, 200);
      expect(mockRepo.list).toHaveBeenCalledWith(null, 100);
      expect(result).toBe(page);
    });
  });
});
