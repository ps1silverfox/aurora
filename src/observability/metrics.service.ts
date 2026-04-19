import { Injectable } from '@nestjs/common';

export interface ICounter {
  add(value: number, attributes?: Record<string, string>): void;
}

export interface IHistogram {
  record(value: number, attributes?: Record<string, string>): void;
}

class NoopCounter implements ICounter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  add(_value: number, _attributes?: Record<string, string>): void {}
}

class NoopHistogram implements IHistogram {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  record(_value: number, _attributes?: Record<string, string>): void {}
}

@Injectable()
export class MetricsService {
  httpRequestTotal: ICounter = new NoopCounter();
  httpRequestDuration: IHistogram = new NoopHistogram();
  valkeyHitTotal: ICounter = new NoopCounter();
  valkeyMissTotal: ICounter = new NoopCounter();

  private oraclePoolActiveValue = 0;
  private aqQueueDepthValue = 0;

  private tryInitOtel(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const otelApi = require('@opentelemetry/sdk-node') as {
        metrics?: { getMeter(name: string): unknown };
      };
      if (!otelApi.metrics) return;

      const meter = otelApi.metrics.getMeter('aurora-cms') as {
        createCounter(name: string, options?: object): ICounter;
        createHistogram(name: string, options?: object): IHistogram;
        createObservableGauge(name: string, options?: object): { addCallback(cb: (obs: { observe(v: number): void }) => void): void };
      };

      this.httpRequestTotal = meter.createCounter('http_requests_total', { description: 'Total HTTP requests' });
      this.httpRequestDuration = meter.createHistogram('http_request_duration_ms', {
        description: 'HTTP request duration in milliseconds',
        unit: 'ms',
        advice: { explicitBucketBoundaries: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000] },
      });
      this.valkeyHitTotal = meter.createCounter('valkey_cache_hits_total', { description: 'Total Valkey cache hits' });
      this.valkeyMissTotal = meter.createCounter('valkey_cache_misses_total', { description: 'Total Valkey cache misses' });

      const poolGauge = meter.createObservableGauge('oracle_pool_active_connections', { description: 'Active Oracle pool connections' });
      poolGauge.addCallback((obs) => { obs.observe(this.oraclePoolActiveValue); });

      const aqGauge = meter.createObservableGauge('oracle_aq_queue_depth', { description: 'Oracle AQ queue depth' });
      aqGauge.addCallback((obs) => { obs.observe(this.aqQueueDepthValue); });
    } catch {
      // OTel not available — noop metrics remain in place
    }
  }

  constructor() {
    this.tryInitOtel();
  }

  setOraclePoolActive(count: number): void {
    this.oraclePoolActiveValue = count;
  }

  setAqQueueDepth(count: number): void {
    this.aqQueueDepthValue = count;
  }
}
