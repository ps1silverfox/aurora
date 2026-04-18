export interface AqConsumer {
  readonly topic: string;
  handle(subject: string, payload: string): Promise<void>;
}

export const AQ_CONSUMERS = Symbol('AQ_CONSUMERS');
