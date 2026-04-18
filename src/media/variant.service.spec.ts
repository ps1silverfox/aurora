import { Test, TestingModule } from '@nestjs/testing';
import { VariantService } from './variant.service';
import { DB_SERVICE } from '../db/db.interface';
import { STORAGE_DRIVER } from './storage/storage.interface';

// @csv-mode
jest.mock('sharp', () =>
  jest.fn().mockImplementation(() => {
    const instance: { resize: jest.Mock; toBuffer: jest.Mock } = {
      resize: jest.fn().mockImplementation(() => instance),
      toBuffer: jest.fn().mockResolvedValue({
        data: Buffer.alloc(100),
        info: { width: 150, height: 100, format: 'jpeg', size: 100, channels: 3, premultiplied: false },
      }),
    };
    return instance;
  }),
);

describe('VariantService', () => {
  let service: VariantService;
  let mockDb: { query: jest.Mock; execute: jest.Mock; executeBatch: jest.Mock };
  let mockStorage: { upload: jest.Mock; delete: jest.Mock; url: jest.Mock; read: jest.Mock };

  beforeEach(async () => {
    mockDb = {
      query: jest
        .fn()
        .mockResolvedValue([{ ID: 'AABBCCDDAABBCCDDAABBCCDDAABBCCDD' }]),
      execute: jest.fn().mockResolvedValue(undefined),
      executeBatch: jest.fn().mockResolvedValue(undefined),
    };

    mockStorage = {
      read: jest.fn().mockResolvedValue(Buffer.from('source-image-data')),
      upload: jest.fn().mockResolvedValue('uploaded-path'),
      delete: jest.fn().mockResolvedValue(undefined),
      url: jest.fn().mockReturnValue('/media/path'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VariantService,
        { provide: DB_SERVICE, useValue: mockDb },
        { provide: STORAGE_DRIVER, useValue: mockStorage },
      ],
    }).compile();

    service = module.get<VariantService>(VariantService);

    jest.clearAllMocks();
    // Restore mocks that were cleared
    mockDb.query.mockResolvedValue([{ ID: 'AABBCCDDAABBCCDDAABBCCDDAABBCCDD' }]);
    mockDb.execute.mockResolvedValue(undefined);
    mockStorage.read.mockResolvedValue(Buffer.from('source-image-data'));
    mockStorage.upload.mockResolvedValue('uploaded-path');
  });

  describe('generateVariants', () => {
    it('returns empty array for application/pdf (non-image)', async () => {
      const result = await service.generateVariants('uuid-1', 'docs/file.pdf', 'application/pdf');
      expect(result).toHaveLength(0);
      expect(mockStorage.read).not.toHaveBeenCalled();
    });

    it('returns empty array for image/svg+xml (not rasterizable)', async () => {
      const result = await service.generateVariants('uuid-1', 'icons/logo.svg', 'image/svg+xml');
      expect(result).toHaveLength(0);
      expect(mockStorage.read).not.toHaveBeenCalled();
    });

    it('returns empty array for video/mp4', async () => {
      const result = await service.generateVariants('uuid-1', 'video/clip.mp4', 'video/mp4');
      expect(result).toHaveLength(0);
    });

    it('generates 4 variants for image/jpeg', async () => {
      const result = await service.generateVariants('uuid-1', '2025/04/img.jpg', 'image/jpeg');
      expect(result).toHaveLength(4);
    });

    it('generates 4 variants for image/png', async () => {
      const result = await service.generateVariants('uuid-1', '2025/04/img.png', 'image/png');
      expect(result).toHaveLength(4);
    });

    it('generates 4 variants for image/webp', async () => {
      const result = await service.generateVariants('uuid-1', '2025/04/img.webp', 'image/webp');
      expect(result).toHaveLength(4);
    });

    it('reads source file from storage before processing', async () => {
      await service.generateVariants('uuid-1', '2025/04/img.jpg', 'image/jpeg');
      expect(mockStorage.read).toHaveBeenCalledWith('2025/04/img.jpg');
      expect(mockStorage.read).toHaveBeenCalledTimes(1);
    });

    it('uploads each variant to storage — 4 total uploads', async () => {
      await service.generateVariants('uuid-1', '2025/04/img.jpg', 'image/jpeg');
      expect(mockStorage.upload).toHaveBeenCalledTimes(4);
    });

    it('uses correct _variant suffix naming for storage paths', async () => {
      await service.generateVariants('uuid-1', '2025/04/abc.jpg', 'image/jpeg');
      const uploadedPaths = (mockStorage.upload.mock.calls as [unknown, string][]).map(
        (call) => call[1],
      );
      expect(uploadedPaths).toContain('2025/04/abc_thumbnail.jpg');
      expect(uploadedPaths).toContain('2025/04/abc_small.jpg');
      expect(uploadedPaths).toContain('2025/04/abc_medium.jpg');
      expect(uploadedPaths).toContain('2025/04/abc_large.jpg');
    });

    it('inserts one MEDIA_VARIANTS row per variant via bound SQL', async () => {
      await service.generateVariants('uuid-1', '2025/04/img.jpg', 'image/jpeg');
      expect(mockDb.execute).toHaveBeenCalledTimes(4);
      const sqls = (mockDb.execute.mock.calls as [string, unknown][]).map((c) => c[0]);
      expect(sqls.every((sql) => sql.includes('MEDIA_VARIANTS'))).toBe(true);
    });

    it('passes bind variables to INSERT — no string interpolation in SQL', async () => {
      await service.generateVariants('uuid-1', '2025/04/img.jpg', 'image/jpeg');
      const [, binds] = mockDb.execute.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(binds).toMatchObject({
        mediaId: expect.any(String) as string,
        variant: expect.any(String) as string,
        storagePath: expect.any(String) as string,
        width: expect.any(Number) as number,
        height: expect.any(Number) as number,
      });
    });

    it('returns MediaVariant objects with correct shape', async () => {
      const variants = await service.generateVariants(
        '550e8400-e29b-41d4-a716-446655440000',
        '2025/04/img.jpg',
        'image/jpeg',
      );
      for (const v of variants) {
        expect(v).toMatchObject({
          id: expect.any(String) as string,
          mediaId: '550e8400-e29b-41d4-a716-446655440000',
          variant: expect.stringMatching(/^(thumbnail|small|medium|large)$/) as string,
          storagePath: expect.any(String) as string,
          width: expect.any(Number) as number,
          height: expect.any(Number) as number,
        });
      }
    });

    it('returns all four variant names', async () => {
      const variants = await service.generateVariants('uuid-1', '2025/04/img.png', 'image/png');
      const names = variants.map((v) => v.variant);
      expect(names).toContain('thumbnail');
      expect(names).toContain('small');
      expect(names).toContain('medium');
      expect(names).toContain('large');
    });

    it('uses fallback UUID when DB query returns no ID row', async () => {
      mockDb.query.mockResolvedValue([]);
      const variants = await service.generateVariants('uuid-1', '2025/04/img.jpg', 'image/jpeg');
      expect(variants.every((v) => typeof v.id === 'string' && v.id.length > 0)).toBe(true);
    });
  });
});
