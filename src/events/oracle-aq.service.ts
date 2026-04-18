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

@Injectable()
export class OracleAqService implements IEventPublisher {
  private readonly logger = new Logger(OracleAqService.name);

  constructor(@Inject(DB_SERVICE) private readonly db: IDbService) {}

  publish(topic: string, payload: unknown): void {
    const queueName = TOPIC_TO_QUEUE[topic];
    if (!queueName) {
      this.logger.warn(`No AQ queue mapped for topic: ${topic}`);
      return;
    }

    const payloadJson = JSON.stringify(payload);

    // Fire-and-forget: errors are logged but do not propagate to callers.
    // In CSV mode DbService.execute() is a no-op for BEGIN blocks.
    this.db
      .execute(ENQUEUE_SQL, { queueName, topic, payload: payloadJson, msgId: null })
      .then(() => { this.logger.debug(`Enqueued ${topic} → ${queueName}`); })
      .catch((err: unknown) => { this.logger.error(`AQ enqueue failed for ${topic}`, err); });
  }
}
