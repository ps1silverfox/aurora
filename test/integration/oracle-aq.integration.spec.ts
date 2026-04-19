// @csv-mode — OracleAqService uses an in-memory queue array; no Oracle AQ connection needed
jest.setTimeout(15000);

import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleModule } from '@nestjs/schedule';
import { OracleAqService, clearCsvQueues } from '../../src/events/oracle-aq.service';
import { ConsumerSchedulerService } from '../../src/events/consumer-scheduler.service';
import { ContentPublishedConsumer } from '../../src/events/consumers/content-published.consumer';
import { ContentUpdatedConsumer } from '../../src/events/consumers/content-updated.consumer';
import { ContentDeletedConsumer } from '../../src/events/consumers/content-deleted.consumer';
import { MediaUploadedConsumer } from '../../src/events/consumers/media-uploaded.consumer';
import { AQ_CONSUMERS } from '../../src/events/aq-consumer.interface';
import { DB_SERVICE } from '../../src/db/db.interface';
import { SearchService } from '../../src/search/search.service';
import { VariantService } from '../../src/media/variant.service';

describe('Oracle AQ event flow integration (csv-mode)', () => {
  let scheduler: ConsumerSchedulerService;
  let aqService: OracleAqService;
  let searchIndexSpy: jest.SpyInstance;
  let variantGenerateSpy: jest.SpyInstance;

  beforeAll(async () => {
    const mockDb = { query: jest.fn().mockResolvedValue([]), execute: jest.fn().mockResolvedValue(undefined), executeBatch: jest.fn().mockResolvedValue(undefined), executeOut: jest.fn().mockResolvedValue({}) };
    const mockSearch = { index: jest.fn().mockResolvedValue(undefined), search: jest.fn().mockResolvedValue({ data: [], nextCursor: null, prevCursor: null }), remove: jest.fn().mockResolvedValue(undefined) };
    const mockVariant = { generateVariants: jest.fn().mockResolvedValue(undefined) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot()],
      providers: [
        { provide: DB_SERVICE, useValue: mockDb },
        { provide: SearchService, useValue: mockSearch },
        { provide: VariantService, useValue: mockVariant },
        OracleAqService,
        ContentPublishedConsumer,
        ContentUpdatedConsumer,
        ContentDeletedConsumer,
        MediaUploadedConsumer,
        {
          provide: AQ_CONSUMERS,
          useFactory: (pub: ContentPublishedConsumer, upd: ContentUpdatedConsumer, del: ContentDeletedConsumer, med: MediaUploadedConsumer) => [pub, upd, del, med],
          inject: [ContentPublishedConsumer, ContentUpdatedConsumer, ContentDeletedConsumer, MediaUploadedConsumer],
        },
        ConsumerSchedulerService,
      ],
    }).compile();

    aqService = moduleRef.get(OracleAqService);
    scheduler = moduleRef.get(ConsumerSchedulerService);
    searchIndexSpy = jest.spyOn(mockSearch, 'index');
    variantGenerateSpy = jest.spyOn(mockVariant, 'generateVariants');
  });

  beforeEach(() => {
    clearCsvQueues();
    jest.clearAllMocks();
  });

  it('publish content.created event → consumer calls SearchService.index()', async () => {
    const pageId = 'aa000000-0000-0000-0000-000000000001';
    aqService.publish('content.created', { id: pageId, title: 'Test Page' });

    await scheduler.pollAll();

    expect(searchIndexSpy).toHaveBeenCalledTimes(1);
    expect(searchIndexSpy).toHaveBeenCalledWith(pageId);
  });

  it('publish content.updated event → SearchService.index() called with correct id', async () => {
    const pageId = 'aa000000-0000-0000-0000-000000000002';
    aqService.publish('content.updated', { id: pageId });

    await scheduler.pollAll();

    expect(searchIndexSpy).toHaveBeenCalledWith(pageId);
  });

  it('publish media.uploaded event → VariantService.generateVariants() called', async () => {
    const mediaId = 'bb000000-0000-0000-0000-000000000001';
    aqService.publish('media.uploaded', { id: mediaId, filename: 'photo.jpg', mimeType: 'image/jpeg' });

    await scheduler.pollAll();

    expect(variantGenerateSpy).toHaveBeenCalledTimes(1);
    expect(variantGenerateSpy).toHaveBeenCalledWith(mediaId, 'photo.jpg', 'image/jpeg');
  });

  it('publish same event twice → downstream called twice (FIFO queue, no dedup by default)', async () => {
    const pageId = 'aa000000-0000-0000-0000-000000000003';
    aqService.publish('content.created', { id: pageId, title: 'Duplicate' });
    aqService.publish('content.created', { id: pageId, title: 'Duplicate' });

    await scheduler.pollAll(); // drains one message per poll
    await scheduler.pollAll(); // drains second message

    expect(searchIndexSpy).toHaveBeenCalledTimes(2);
  });

  it('empty queue → no downstream calls made', async () => {
    await scheduler.pollAll();
    expect(searchIndexSpy).not.toHaveBeenCalled();
    expect(variantGenerateSpy).not.toHaveBeenCalled();
  });

  it('content.deleted event → SearchService.remove() called', async () => {
    const mockSearch = { remove: jest.fn().mockResolvedValue(undefined) };
    const consumer = new ContentDeletedConsumer(mockSearch as unknown as SearchService);
    const removeSpy = jest.spyOn(mockSearch, 'remove');

    const pageId = 'aa000000-0000-0000-0000-000000000004';
    await consumer.handle('content.deleted', JSON.stringify({ id: pageId }));

    expect(removeSpy).toHaveBeenCalledWith(pageId);
  });
});
