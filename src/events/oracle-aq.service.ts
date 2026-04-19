import { Inject, Injectable, Logger } from '@nestjs/common';
import { DB_SERVICE, IDbService } from '../db/db.interface';
import { IEventPublisher } from './event-publisher.interface';
import { TOPIC_TO_QUEUE } from './event-types';

const ENQUEUE_SQL = `BEGIN
  DBMS_AQ.ENQUEUE(
    queue_name         => :queueName,
    enqueue_options    => DBMS_AQ.ENQUEUE_OPTIONS_T(),
    message_properties => DBMS_AQ.MESSAGE_PROPERTIES_T(),
    payload            => AQ_EVENT_TYPE(:topic, :payload),
    msgid              => :msgId
  );
  COMMIT;
END;`;

const DEQUEUE_SQL = `DECLARE
  l_dequeue_options    DBMS_AQ.DEQUEUE_OPTIONS_T;
  l_message_properties DBMS_AQ.MESSAGE_PROPERTIES_T;
  l_msgid              RAW(16);
  l_payload            AQ_EVENT_TYPE;
BEGIN
  l_dequeue_options.wait       := DBMS_AQ.NO_WAIT;
  l_dequeue_options.visibility := DBMS_AQ.IMMEDIATE;
  DBMS_AQ.DEQUEUE(
    queue_name         => :queueName,
    dequeue_options    => l_dequeue_options,
    message_properties => l_message_properties,
    payload            => l_payload,
    msgid              => l_msgid
  );
  :subject := l_payload.SUBJECT;
  :payload := l_payload.PAYLOAD;
  COMMIT;
END;`;

// In CSV mode, an in-memory per-topic queue replaces Oracle AQ.
const CSV_QUEUES = new Map<string, { subject: string; payload: string }[]>();

function csvEnqueue(topic: string, payload: string): void {
  const q = CSV_QUEUES.get(topic) ?? [];
  q.push({ subject: topic, payload });
  CSV_QUEUES.set(topic, q);
}

function csvDequeue(topic: string): { subject: string; payload: string } | null {
  const q = CSV_QUEUES.get(topic);
  if (!q || q.length === 0) return null;
  return q.shift() ?? null;
}

/** Exposed for tests: drain all in-memory queues. */
export function clearCsvQueues(): void {
  CSV_QUEUES.clear();
}

@Injectable()
export class OracleAqService implements IEventPublisher {
  private readonly logger = new Logger(OracleAqService.name);
  private readonly csvMode = process.env['DB_DRIVER'] !== 'oracle';

  constructor(@Inject(DB_SERVICE) private readonly db: IDbService) {}

  async dequeue(topic: string): Promise<{ subject: string; payload: string } | null> {
    if (this.csvMode) return csvDequeue(topic);

    const queueName = TOPIC_TO_QUEUE[topic];
    if (!queueName) {
      this.logger.warn(`No AQ queue mapped for topic: ${topic}`);
      return null;
    }
    try {
      const out = await this.db.executeOut(DEQUEUE_SQL, {
        queueName,
        subject: { dir: 'out', type: 'string' },
        payload: { dir: 'out', type: 'string' },
      });
      if (!out['subject'] && !out['payload']) return null;
      return { subject: out['subject'] as string, payload: out['payload'] as string };
    } catch (err: unknown) {
      // ORA-25228: no message available — normal empty-queue condition
      const msg = (err as { message?: string }).message ?? '';
      if (msg.includes('ORA-25228')) return null;
      this.logger.error(`AQ dequeue failed for ${topic}`, err);
      throw err;
    }
  }

  publish(topic: string, payload: unknown): void {
    const payloadJson = JSON.stringify(payload);

    if (this.csvMode) {
      csvEnqueue(topic, payloadJson);
      this.logger.debug(`[csv] Enqueued ${topic}`);
      return;
    }

    const queueName = TOPIC_TO_QUEUE[topic];
    if (!queueName) {
      this.logger.warn(`No AQ queue mapped for topic: ${topic}`);
      return;
    }

    // Fire-and-forget: errors are logged but do not propagate to callers.
    this.db
      .execute(ENQUEUE_SQL, { queueName, topic, payload: payloadJson, msgId: null })
      .then(() => { this.logger.debug(`Enqueued ${topic} → ${queueName}`); })
      .catch((err: unknown) => { this.logger.error(`AQ enqueue failed for ${topic}`, err); });
  }
}
