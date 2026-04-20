// @csv-mode
import { Test, TestingModule } from '@nestjs/testing';
import { OracleAqService, clearCsvQueues } from './oracle-aq.service';
import { DB_SERVICE, IDbService } from '../db/db.interface';

describe('OracleAqService (csv-mode)', () => {
  let service: OracleAqService;

  beforeEach(async () => {
    clearCsvQueues();
    const db: jest.Mocked<IDbService> = {
      query: jest.fn(),
      execute: jest.fn().mockResolvedValue(undefined),
      executeBatch: jest.fn(),
      executeOut: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OracleAqService,
        { provide: DB_SERVICE, useValue: db },
      ],
    }).compile();

    service = module.get(OracleAqService);
  });

  it('publish enqueues message; dequeue retrieves it', async () => {
    service.publish('content.created', { id: 'page-1', title: 'Hello' });
    const msg = await service.dequeue('content.created');
    expect(msg).not.toBeNull();
    expect(msg?.subject).toBe('content.created');
    expect(msg?.payload).toBe(JSON.stringify({ id: 'page-1', title: 'Hello' }));
  });

  it('dequeue returns null when queue is empty', async () => {
    const msg = await service.dequeue('content.created');
    expect(msg).toBeNull();
  });

  it('messages are FIFO — first in first out', async () => {
    service.publish('content.created', { id: 'first' });
    service.publish('content.created', { id: 'second' });

    const msg1 = await service.dequeue('content.created');
    const msg2 = await service.dequeue('content.created');

    expect(JSON.parse(msg1?.payload ?? '{}') as { id: string }).toEqual({ id: 'first' });
    expect(JSON.parse(msg2?.payload ?? '{}') as { id: string }).toEqual({ id: 'second' });
  });

  it('topics are isolated — different topics do not interfere', async () => {
    service.publish('content.created', { id: 'content' });
    service.publish('media.uploaded', { id: 'media' });

    const content = await service.dequeue('content.created');
    const media = await service.dequeue('media.uploaded');

    expect(JSON.parse(content?.payload ?? '{}') as { id: string }).toMatchObject({ id: 'content' });
    expect(JSON.parse(media?.payload ?? '{}') as { id: string }).toMatchObject({ id: 'media' });
  });

  it('publish for unknown topic does not throw', () => {
    expect(() => { service.publish('unknown.topic', {}); }).not.toThrow();
  });
});
