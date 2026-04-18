export const EVENT_PUBLISHER = 'EVENT_PUBLISHER';

export interface IEventPublisher {
  publish(event: string, payload: unknown): void;
}
