import { Test } from '@nestjs/testing';
import { KnowledgeBaseService } from './knowledge-base.service';
import { DB_SERVICE } from '../db/db.interface';
import { VALKEY_CLIENT } from '../auth/auth.constants';

const mockDb = {
  query: jest.fn(),
  execute: jest.fn(),
  executeOut: jest.fn(),
  executeBatch: jest.fn(),
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
};

async function makeService(withRedis = true): Promise<KnowledgeBaseService> {
  const mod = await Test.createTestingModule({
    providers: [
      KnowledgeBaseService,
      { provide: DB_SERVICE, useValue: mockDb },
      ...(withRedis ? [{ provide: VALKEY_CLIENT, useValue: mockRedis }] : []),
    ],
  }).compile();
  return mod.get(KnowledgeBaseService);
}

describe('KnowledgeBaseService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockDb.execute.mockResolvedValue(undefined);
    mockDb.query.mockResolvedValue([]);
  });

  describe('viewPage', () => {
    it('increments view count when no prior visit', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const svc = await makeService();
      await svc.viewPage('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', '1.2.3.4');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'view:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:1.2.3.4',
        '1',
        'EX',
        3600,
      );
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('VIEW_COUNT = VIEW_COUNT + 1'),
        expect.objectContaining({ id: 'AAAAAAAABBBBCCCCDDDDEEEEEEEEEEEE' }),
      );
    });

    it('skips increment when IP already counted within window', async () => {
      mockRedis.get.mockResolvedValue('1');

      const svc = await makeService();
      await svc.viewPage('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', '1.2.3.4');

      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('increments without rate-limit when redis unavailable', async () => {
      const svc = await makeService(false);
      await svc.viewPage('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', '1.2.3.4');

      expect(mockDb.execute).toHaveBeenCalled();
    });
  });

  describe('ratePage', () => {
    it('inserts helpful rating', async () => {
      const svc = await makeService();
      await svc.ratePage('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', true);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO PAGE_RATINGS'),
        expect.objectContaining({ helpful: 1 }),
      );
    });

    it('inserts unhelpful rating', async () => {
      const svc = await makeService();
      await svc.ratePage('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', false);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ helpful: 0 }),
      );
    });
  });

  describe('getHelpfulPct', () => {
    it('returns null when no ratings', async () => {
      mockDb.query.mockResolvedValue([{ TOTAL: 0, HELPFUL_SUM: 0 }]);

      const svc = await makeService();
      const result = await svc.getHelpfulPct('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');

      expect(result).toBeNull();
    });

    it('returns null when rows empty', async () => {
      mockDb.query.mockResolvedValue([]);

      const svc = await makeService();
      expect(await svc.getHelpfulPct('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBeNull();
    });

    it('calculates percentage correctly', async () => {
      mockDb.query.mockResolvedValue([{ TOTAL: 4, HELPFUL_SUM: 3 }]);

      const svc = await makeService();
      const result = await svc.getHelpfulPct('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');

      expect(result).toBe(75);
    });

    it('strips hyphens from uuid for bind variable', async () => {
      mockDb.query.mockResolvedValue([{ TOTAL: 0, HELPFUL_SUM: 0 }]);

      const svc = await makeService();
      await svc.getHelpfulPct('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ id: 'AAAAAAAABBBBCCCCDDDDEEEEEEEEEEEE' }),
      );
    });
  });
});
