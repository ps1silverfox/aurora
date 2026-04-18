import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OracleAqService } from './oracle-aq.service';
import { AQ_CONSUMERS, AqConsumer } from './aq-consumer.interface';

const POLL_INTERVAL_MS = 5000;

@Injectable()
export class ConsumerSchedulerService {
  private readonly logger = new Logger(ConsumerSchedulerService.name);

  constructor(
    private readonly aq: OracleAqService,
    @Optional() @Inject(AQ_CONSUMERS) private readonly consumers: AqConsumer[] = [],
  ) {}

  @Interval(POLL_INTERVAL_MS)
  async pollAll(): Promise<void> {
    await Promise.all(this.consumers.map((c) => this.pollOne(c)));
  }

  private async pollOne(consumer: AqConsumer): Promise<void> {
    let msg: { subject: string; payload: string } | null;
    try {
      msg = await this.aq.dequeue(consumer.topic);
    } catch {
      return; // error already logged in OracleAqService
    }
    if (!msg) return;

    try {
      await consumer.handle(msg.subject, msg.payload);
    } catch (err: unknown) {
      this.logger.error(
        `Consumer ${consumer.topic} failed — message will be NACKed to DLQ`,
        err,
      );
    }
  }
}
