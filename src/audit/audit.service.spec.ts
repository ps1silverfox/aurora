import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { DB_SERVICE, IDbService } from '../db/db.interface';

const mockDb: jest.Mocked<IDbService> = {
  query: jest.fn(),
  execute: jest.fn(),
  executeBatch: jest.fn(),
  executeOut: jest.fn().mockResolvedValue({}),
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb.execute.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: DB_SERVICE, useValue: mockDb }],
    }).compile();

    service = module.get(AuditService);
  });

  describe('log()', () => {
    it('calls audit_pkg.INSERT_ENTRY with correct binds for full entry', async () => {
      const actorId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      await service.log({
        actorId,
        action: 'user.created',
        entityType: 'USER',
        entityId: actorId,
        diff: { email: 'new@example.com' },
      });

      expect(mockDb.execute).toHaveBeenCalledTimes(1);
      const [sql, binds] = mockDb.execute.mock.calls[0] as [string, Record<string, unknown>];

      expect(sql).toContain('audit_pkg.INSERT_ENTRY');
      expect(sql).toContain('HEXTORAW(:actorId)');
      expect(binds).toMatchObject({
        actorId: 'a1b2c3d4e5f67890abcdef1234567890',
        action: 'user.created',
        entityType: 'USER',
        entityId: actorId,
        diff: JSON.stringify({ email: 'new@example.com' }),
      });
    });

    it('passes null actorId when actor is system (null)', async () => {
      await service.log({ actorId: null, action: 'system.boot' });

      const [, binds] = mockDb.execute.mock.calls[0] as [string, Record<string, unknown>];
      expect(binds).toMatchObject({ actorId: null });
    });

    it('passes null entityType and entityId when omitted', async () => {
      await service.log({ actorId: null, action: 'health.check' });

      const [, binds] = mockDb.execute.mock.calls[0] as [string, Record<string, unknown>];
      expect(binds).toMatchObject({ entityType: null, entityId: null });
    });

    it('passes null diff when diff is omitted', async () => {
      await service.log({ actorId: null, action: 'health.check' });

      const [, binds] = mockDb.execute.mock.calls[0] as [string, Record<string, unknown>];
      expect(binds).toMatchObject({ diff: null });
    });

    it('serialises diff object to JSON string', async () => {
      await service.log({
        actorId: null,
        action: 'page.updated',
        diff: { title: ['old', 'new'] },
      });

      const [, binds] = mockDb.execute.mock.calls[0] as [string, Record<string, unknown>];
      expect(binds).toMatchObject({ diff: '{"title":["old","new"]}' });
    });

    it('strips hyphens from actorId UUID before binding', async () => {
      await service.log({ actorId: '00000000-0000-0000-0000-000000000001', action: 'test' });

      const [, binds] = mockDb.execute.mock.calls[0] as [string, Record<string, unknown>];
      expect(binds.actorId).toBe('00000000000000000000000000000001');
      expect(binds.actorId).not.toContain('-');
    });

    it('propagates db errors to caller', async () => {
      mockDb.execute.mockRejectedValueOnce(new Error('ORA-01403'));
      await expect(
        service.log({ actorId: null, action: 'will.fail' }),
      ).rejects.toThrow('ORA-01403');
    });
  });
});
