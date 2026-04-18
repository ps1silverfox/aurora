import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BlockTemplatesController, CreateBlockTemplateDto } from './block-templates.controller';
import { BlockTemplatesService, BlockTemplate } from './block-templates.service';
import { RolesGuard } from '../users/roles.guard';
import { AuthenticatedUser } from '../auth/types';
import { NotFoundError } from '../common/errors';

const adminUser: AuthenticatedUser = { id: 'user-1', email: 'admin@x.com', name: 'Admin', roles: ['admin'] };

function makeTemplate(overrides: Partial<BlockTemplate> = {}): BlockTemplate {
  return {
    id: 'tpl-1',
    name: 'Hero Banner',
    blockType: 'section',
    content: { title: 'Hello', content: 'World' },
    createdBy: 'user-1',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('BlockTemplatesController', () => {
  let controller: BlockTemplatesController;
  let service: jest.Mocked<BlockTemplatesService>;

  beforeEach(async () => {
    service = {
      list: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<BlockTemplatesService>;

    const module = await Test.createTestingModule({
      controllers: [BlockTemplatesController],
      providers: [
        { provide: BlockTemplatesService, useValue: service },
        { provide: RolesGuard, useValue: { canActivate: () => true } },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(BlockTemplatesController);
  });

  describe('list', () => {
    it('returns all templates', async () => {
      const templates = [makeTemplate(), makeTemplate({ id: 'tpl-2', name: 'Card' })];
      service.list.mockResolvedValue(templates);

      const result = await controller.list();

      expect(result).toEqual(templates);
      expect(service.list).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no templates', async () => {
      service.list.mockResolvedValue([]);
      expect(await controller.list()).toEqual([]);
    });
  });

  describe('create', () => {
    it('creates template and returns it', async () => {
      const dto: CreateBlockTemplateDto = { name: 'Hero', blockType: 'section', content: { title: 'T' } };
      const created = makeTemplate({ name: 'Hero', blockType: 'section', content: { title: 'T' } });
      service.create.mockResolvedValue(created);

      const result = await controller.create(dto, adminUser);

      expect(result).toEqual(created);
      expect(service.create).toHaveBeenCalledWith({ name: 'Hero', blockType: 'section', content: { title: 'T' } }, 'user-1');
    });
  });

  describe('remove', () => {
    it('calls service.delete with the id', async () => {
      service.delete.mockResolvedValue();
      await controller.remove('tpl-1');
      expect(service.delete).toHaveBeenCalledWith('tpl-1');
    });

    it('throws NotFoundException when template not found', async () => {
      service.delete.mockRejectedValue(new NotFoundError('not found'));
      await expect(controller.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
