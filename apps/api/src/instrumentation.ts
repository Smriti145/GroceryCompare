// Load this before Express, database clients and outbound HTTP modules.
import './config/env';
import * as Sentry from '@sentry/node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
class RedactedTraceExporter extends OTLPTraceExporter {
  export(
    spans: Parameters<OTLPTraceExporter['export']>[0],
    callback: Parameters<OTLPTraceExporter['export']>[1],
  ) {
    // Allowlist metadata; never export SQL text, URL queries, headers, exception events or user identifiers.
    const allowed = new Set([
      'http.request.method',
      'http.method',
      'http.response.status_code',
      'http.status_code',
      'http.route',
      'db.system',
      'db.system.name',
      'rpc.system',
    ]);
    const safe = spans.map(span =>
      Object.assign(Object.create(Object.getPrototypeOf(span)), span, {
        name: String(
          span.attributes['http.route'] ||
            span.attributes['db.system'] ||
            'operation',
        ),
        attributes: Object.fromEntries(
          Object.entries(span.attributes).filter(([key]) => allowed.has(key)),
        ),
        events: [],
        status: { code: span.status.code },
        links: [],
      }),
    );
    super.export(safe, callback);
  }
}
if (process.env.SENTRY_DSN)
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0,
    beforeSend(event) {
      delete event.request;
      delete event.user;
      delete event.breadcrumbs;
      delete event.extra;
      return event;
    },
  });
export const telemetry = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ? new NodeSDK({
      serviceName: 'grocerycompare-api',
      traceExporter: new RedactedTraceExporter(),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
        }),
      ],
    })
  : null;
telemetry?.start();
