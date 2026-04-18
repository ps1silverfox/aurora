import { Test } from '@nestjs/testing';
import { MediaService } from './media.service';
import { DB_SERVICE } from '../db/db.interface';
import { STORAGE_DRIVER } from './storage/storage.interface';
import { AuditService } from '../audit/audit.service';
import { ValidationError, NotFoundError } from '../common/errors';

const mockDb = {
  query: jest.fn(),
  execute: jest.fn(),
  executeBatch: jest.fn(),
  executeOut: jest.fn().mockResolvedValue({}),
};

const mockStorage = {
  upload: jest.fn(),
  delete: jest.fn(),
  url: jest.fn(),
};

const mockAudit = { log: jest.fn() };

const UPLOADER_UUID = 'aabbccdd-1122-3344-aabb-ccdd11223344';
const MEDIA_RAW = 'AABBCCDD11223344AABBCCDD11223344';
const MEDIA_UUID = 'aabbccdd-1122-3344-aabb-ccdd11223344';

const mediaRow = {
  ID: MEDIA_RAW,
  FILENAME: 'test.jpg',
  MIME_TYPE: 'image/jpeg',
  SIZE_BYTES: 1024,
  STORAGE_DRIVER: 'local',
  STORAGE_PATH: '2024/01/abc123.jpg',
  UPLOADED_BY: MEDIA_RAW,
  CREATED_AT: new Date('2024-01-01T00:00:00Z'),
  DELETED_AT: null,
};

describe('MediaService', () => {
  let service: MediaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: DB_SERVICE, useValue: mockDb },
        { provide: STORAGE_DRIVER, useValue: mockStorage },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(MediaService);
  });

  describe('upload — happy path', () => {
    it('stores file and inserts DB row', async () => {
      mockStorage.upload.mockResolvedValue('2024/01/abc123.jpg');
      mockDb.execute.mockResolvedValue(undefined);
      mockDb.query.mockResolvedValue([mediaRow]);
      mockAudit.log.mockResolvedValue(undefined);

      const file = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('fake'),
      };

      const result = await service.upload(file, UPLOADER_UUID);

      expect(mockStorage.upload).toHaveBeenCalledWith(file, expect.any(String));
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO MEDIA'),
        expect.objectContaining({ filename: 'test.jpg', mimeType: 'image/jpeg' }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'media.upload' }),
      );
      expect(result.filename).toBe('test.jpg');
    });
  });

  // TODO: implement these validation tests
  describe('upload — validation', () => {
    it('rejects files exceeding 50MB without touching storage or DB', async () => {
      const file = {
        originalname: 'big.mp4',
        mimetype: 'video/mp4',
        size: 51 * 1024 * 1024,
        buffer: Buffer.alloc(0),
      };

      await expect(service.upload(file, UPLOADER_UUID)).rejects.toThrow(ValidationError);
      expect(mockStorage.upload).not.toHaveBeenCalled();
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('rejects disallowed MIME types without touching storage or DB', async () => {
      const file = {
        originalname: 'script.exe',
        mimetype: 'application/x-msdownload',
        size: 512,
        buffer: Buffer.alloc(0),
      };

      await expect(service.upload(file, UPLOADER_UUID)).rejects.toThrow(ValidationError);
      expect(mockStorage.upload).not.toHaveBeenCalled();
      expect(mockDb.execute).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns mapped media when found', async () => {
      mockDb.query.mockResolvedValue([mediaRow]);
      const result = await service.findById(MEDIA_UUID);
      expect(result.id).toBe(MEDIA_UUID);
      expect(result.filename).toBe('test.jpg');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('HEXTORAW(:id)'),
        expect.objectContaining({ id: MEDIA_RAW }),
      );
    });

    it('throws NotFoundError when not found', async () => {
      mockDb.query.mockResolvedValue([]);
      await expect(service.findById(MEDIA_UUID)).rejects.toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    it('returns cursor-paginated results', async () => {
      mockDb.query.mockResolvedValue([mediaRow]);
      const page = await service.list(undefined, 20);
      expect(page.data).toHaveLength(1);
      expect(page.nextCursor).toBeNull();
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ROW_NUMBER()'),
        expect.objectContaining({ pageSize: 20 }),
      );
    });

    it('generates nextCursor when full page returned', async () => {
      const rows = Array.from({ length: 5 }, (_, i) => ({
        ...mediaRow,
        CREATED_AT: new Date(`2024-01-0${i + 1}T00:00:00Z`),
      }));
      mockDb.query.mockResolvedValue(rows);
      const page = await service.list(undefined, 5);
      expect(page.nextCursor).not.toBeNull();
    });
  });

  describe('delete', () => {
    it('soft-deletes DB row and removes from storage', async () => {
      mockDb.query.mockResolvedValue([mediaRow]);
      mockDb.execute.mockResolvedValue(undefined);
      mockStorage.delete.mockResolvedValue(undefined);
      mockAudit.log.mockResolvedValue(undefined);

      await service.delete(MEDIA_UUID, UPLOADER_UUID);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETED_AT = SYSTIMESTAMP'),
        expect.objectContaining({ id: MEDIA_RAW }),
      );
      expect(mockStorage.delete).toHaveBeenCalledWith(mediaRow.STORAGE_PATH);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'media.delete' }),
      );
    });

    it('still soft-deletes even if storage delete fails', async () => {
      mockDb.query.mockResolvedValue([mediaRow]);
      mockDb.execute.mockResolvedValue(undefined);
      mockStorage.delete.mockRejectedValue(new Error('S3 error'));
      mockAudit.log.mockResolvedValue(undefined);

      await expect(service.delete(MEDIA_UUID, UPLOADER_UUID)).resolves.toBeUndefined();
    });
  });
});
