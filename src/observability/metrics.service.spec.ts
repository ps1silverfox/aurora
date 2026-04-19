import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('initializes with noop instruments when OTel unavailable', () => {
    expect(service.httpRequestTotal).toBeDefined();
    expect(service.httpRequestDuration).toBeDefined();
    expect(service.valkeyHitTotal).toBeDefined();
    expect(service.valkeyMissTotal).toBeDefined();
  });

  it('counter.add does not throw', () => {
    expect(() => { service.httpRequestTotal.add(1, { method: 'GET' }); }).not.toThrow();
  });

  it('histogram.record does not throw', () => {
    expect(() => { service.httpRequestDuration.record(42, { status: '200' }); }).not.toThrow();
  });

  it('setOraclePoolActive does not throw', () => {
    expect(() => { service.setOraclePoolActive(3); }).not.toThrow();
  });

  it('setAqQueueDepth does not throw', () => {
    expect(() => { service.setAqQueueDepth(7); }).not.toThrow();
  });
});
