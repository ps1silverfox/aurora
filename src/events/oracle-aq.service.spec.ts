// @csv-mode
import { Test, TestingModule } from '@nestjs/testing';
import { OracleAqService } from './oracle-aq.service';
import { DB_SERVICE, IDbService } from '../db/db.interface';
import { TOPIC_TO_QUEUE } from './event-types';

/** Flush the microtask queue so fire-and-forget promises resolve before assertions. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('OracleAqService', () => {
  let service: OracleAqService;
  let db: jest.Mocked<IDbService>;

  beforeEach(async () => {
    db = {
      query: jest.fn(),
      execute: jest.fn().mockResolvedValue(undefined),
      executeBatch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OracleAqService,
        { provide: DB_SERVICE, useValue: db },
      ],
    }).compile();

    service = module.get(OracleAqService);
  });

  it('calls execute() with DBMS_AQ.ENQUEUE SQL for content.created', async () => {
    service.publish('content.created', { id: 'abc', slug: 'hello', title: 'Hello' });
    await flush();

    expect(db.execute).toHaveBeenCalledTimes(1);
    const [sql, binds] = db.execute.mock.calls[0] as [string, Record<string, unknown>];
    expect(sql).toMatch(/DBMS_AQ\.ENQUEUE/i);
    expect(binds['queueName']).toBe(TOPIC_TO_QUEUE['content.created']);
    expect(binds['topic']).toBe('content.created');
    expect(binds['payload']).toBe(JSON.stringify({ id: 'abc', slug: 'hello', title: 'Hello' }));
  });

  it('calls execute() with correct queue name for workflow.transition', async () => {
    service.publish('workflow.transition', { pageId: '1', from: 'draft', to: 'review', actorId: 'u1' });
    await flush();

    const [, binds] = db.execute.mock.calls[0] as [string, Record<string, unknown>];
    expect(binds['queueName']).toBe(TOPIC_TO_QUEUE['workflow.transition']);
  });

  it('calls execute() with correct queue name for media.uploaded', async () => {
    service.publish('media.uploaded', { id: 'm1', filename: 'photo.jpg', mimeType: 'image/jpeg', size: 1024 });
    await flush();

    const [, binds] = db.execute.mock.calls[0] as [string, Record<string, unknown>];
    expect(binds['queueName']).toBe(TOPIC_TO_QUEUE['media.uploaded']);
  });

  it('does not call execute() for unknown topic', async () => {
    service.publish('unknown.topic', {});
    await flush();

    expect(db.execute).not.toHaveBeenCalled();
  });

  it('serializes payload as JSON string', async () => {
    const payload = { id: 'x', nested: { value: 42 } };
    service.publish('content.updated', payload);
    await flush();

    const [, binds] = db.execute.mock.calls[0] as [string, Record<string, unknown>];
    expect(binds['payload']).toBe(JSON.stringify(payload));
  });
});
