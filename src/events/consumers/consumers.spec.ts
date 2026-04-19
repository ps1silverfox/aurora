// @csv-mode
import { ContentPublishedConsumer } from './content-published.consumer';
import { ContentUpdatedConsumer } from './content-updated.consumer';
import { ContentDeletedConsumer } from './content-deleted.consumer';
import { MediaUploadedConsumer } from './media-uploaded.consumer';
import { WorkflowTransitionConsumer } from './workflow-transition.consumer';
import { ConsumerSchedulerService } from '../consumer-scheduler.service';
import { OracleAqService } from '../oracle-aq.service';

const mockSearch = { index: jest.fn(), remove: jest.fn() };
const mockVariants = { generateVariants: jest.fn() };

describe('ContentPublishedConsumer', () => {
  let consumer: ContentPublishedConsumer;

  beforeEach(() => {
    jest.clearAllMocks();
    consumer = new ContentPublishedConsumer(mockSearch as never);
  });

  it('calls SearchService.index with page id', async () => {
    const payload = JSON.stringify({ id: 'page-1', slug: 'hello', title: 'Hello' });
    await consumer.handle('content.created', payload);
    expect(mockSearch.index).toHaveBeenCalledWith('page-1');
  });
});

describe('ContentUpdatedConsumer', () => {
  let consumer: ContentUpdatedConsumer;

  beforeEach(() => {
    jest.clearAllMocks();
    consumer = new ContentUpdatedConsumer(mockSearch as never);
  });

  it('calls SearchService.index with page id', async () => {
    const payload = JSON.stringify({ id: 'page-2', title: 'Updated' });
    await consumer.handle('content.updated', payload);
    expect(mockSearch.index).toHaveBeenCalledWith('page-2');
  });
});

describe('ContentDeletedConsumer', () => {
  let consumer: ContentDeletedConsumer;

  beforeEach(() => {
    jest.clearAllMocks();
    consumer = new ContentDeletedConsumer(mockSearch as never);
  });

  it('calls SearchService.remove with page id', async () => {
    const payload = JSON.stringify({ id: 'page-3', slug: 'gone' });
    await consumer.handle('content.deleted', payload);
    expect(mockSearch.remove).toHaveBeenCalledWith('page-3');
  });
});

describe('MediaUploadedConsumer', () => {
  let consumer: MediaUploadedConsumer;

  beforeEach(() => {
    jest.clearAllMocks();
    consumer = new MediaUploadedConsumer(mockVariants as never);
  });

  it('calls VariantService.generateVariants with id, filename, mimeType', async () => {
    const payload = JSON.stringify({
      id: 'media-1',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
    });
    await consumer.handle('media.uploaded', payload);
    expect(mockVariants.generateVariants).toHaveBeenCalledWith(
      'media-1',
      'photo.jpg',
      'image/jpeg',
    );
  });
});

describe('WorkflowTransitionConsumer', () => {
  let consumer: WorkflowTransitionConsumer;
  const mockNotifications = { onWorkflowTransition: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.clearAllMocks();
    consumer = new WorkflowTransitionConsumer(mockNotifications as never);
  });

  it('handles workflow.transition without throwing', async () => {
    const payload = JSON.stringify({
      pageId: 'page-4',
      from: 'draft',
      to: 'published',
      actorId: 'user-1',
    });
    await expect(consumer.handle('workflow.transition', payload)).resolves.toBeUndefined();
  });
});

describe('ConsumerSchedulerService', () => {
  let mockAq: jest.Mocked<Pick<OracleAqService, 'dequeue'>>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAq = { dequeue: jest.fn() };
  });

  it('dispatches dequeued message to matching consumer', async () => {
    const payload = JSON.stringify({ id: 'page-5', slug: 'test', title: 'Test' });
    mockAq.dequeue.mockResolvedValue({ subject: 'content.created', payload });
    mockSearch.index.mockResolvedValue(undefined);

    const consumer = new ContentPublishedConsumer(mockSearch as never);
    const scheduler = new ConsumerSchedulerService(mockAq as never, [consumer]);
    await scheduler.pollAll();

    expect(mockAq.dequeue).toHaveBeenCalledWith('content.created');
    expect(mockSearch.index).toHaveBeenCalledWith('page-5');
  });

  it('skips when dequeue returns null (empty queue)', async () => {
    mockAq.dequeue.mockResolvedValue(null);
    const consumer = new ContentPublishedConsumer(mockSearch as never);
    const scheduler = new ConsumerSchedulerService(mockAq as never, [consumer]);
    await scheduler.pollAll();
    expect(mockSearch.index).not.toHaveBeenCalled();
  });

  it('logs error but does not rethrow when consumer.handle throws', async () => {
    const payload = JSON.stringify({ id: 'page-6', slug: 'err', title: 'Err' });
    mockAq.dequeue.mockResolvedValue({ subject: 'content.created', payload });
    mockSearch.index.mockRejectedValue(new Error('search down'));

    const consumer = new ContentPublishedConsumer(mockSearch as never);
    const scheduler = new ConsumerSchedulerService(mockAq as never, [consumer]);
    await expect(scheduler.pollAll()).resolves.toBeUndefined();
  });
});
