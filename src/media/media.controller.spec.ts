import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { VariantJob } from './variant.job';
import { BadRequestException } from '@nestjs/common';
import { RolesGuard } from '../users/roles.guard';

const mockMediaService = {
  upload: jest.fn(),
  list: jest.fn(),
  findById: jest.fn(),
  delete: jest.fn(),
};

const mockVariantJob = {
  run: jest.fn(),
};

const actor = { id: 'user-uuid-1', roles: ['editor'] };

const sampleMedia = {
  id: 'media-uuid-1',
  filename: 'photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 2048,
  storageDriver: 'local',
  storagePath: '2026/04/photo.jpg',
  uploadedBy: 'user-uuid-1',
  createdAt: new Date('2026-04-17T00:00:00Z'),
  deletedAt: null,
};

describe('MediaController', () => {
  let controller: MediaController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        { provide: MediaService, useValue: mockMediaService },
        { provide: VariantJob, useValue: mockVariantJob },
        { provide: RolesGuard, useValue: { canActivate: () => true } },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(MediaController);
  });

  describe('upload', () => {
    it('throws BadRequestException when no file provided', async () => {
      await expect(controller.upload(undefined, actor as never)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('calls mediaService.upload and fires variantJob.run', async () => {
      mockMediaService.upload.mockResolvedValue(sampleMedia);
      mockVariantJob.run.mockResolvedValue([]);

      const multerFile = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        size: 2048,
        buffer: Buffer.from('data'),
      } as Express.Multer.File;

      const result = await controller.upload(multerFile, actor as never);

      expect(mockMediaService.upload).toHaveBeenCalledWith(
        { originalname: 'photo.jpg', mimetype: 'image/jpeg', size: 2048, buffer: multerFile.buffer },
        actor.id,
      );
      expect(result).toEqual(sampleMedia);
    });
  });

  describe('list', () => {
    it('returns cursor page from mediaService.list', async () => {
      const page = { data: [sampleMedia], nextCursor: null, prevCursor: null };
      mockMediaService.list.mockResolvedValue(page);

      const result = await controller.list(undefined, undefined);

      expect(mockMediaService.list).toHaveBeenCalledWith(undefined, 20);
      expect(result).toEqual(page);
    });

    it('passes cursor and limit', async () => {
      const page = { data: [], nextCursor: null, prevCursor: null };
      mockMediaService.list.mockResolvedValue(page);

      await controller.list('cursor-abc', '10');

      expect(mockMediaService.list).toHaveBeenCalledWith('cursor-abc', 10);
    });
  });

  describe('findOne', () => {
    it('delegates to mediaService.findById', async () => {
      mockMediaService.findById.mockResolvedValue(sampleMedia);
      const result = await controller.findOne('media-uuid-1');
      expect(mockMediaService.findById).toHaveBeenCalledWith('media-uuid-1');
      expect(result).toEqual(sampleMedia);
    });
  });

  describe('remove', () => {
    it('calls mediaService.delete with id and actor', async () => {
      mockMediaService.delete.mockResolvedValue(undefined);
      await controller.remove('media-uuid-1', actor as never);
      expect(mockMediaService.delete).toHaveBeenCalledWith('media-uuid-1', actor.id);
    });
  });
});
