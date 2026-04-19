import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

let sdk: NodeSDK | undefined;

export function initTelemetry(): void {
  const prometheusExporter = new PrometheusExporter({
    port: parseInt(process.env.METRICS_PORT ?? '9464', 10),
    endpoint: '/metrics',
  });

  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'aurora-cms',
    metricReader: prometheusExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: false },
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
}

export function shutdownTelemetry(): Promise<void> {
  return sdk?.shutdown() ?? Promise.resolve();
}
