import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

if (process.env.OTEL_DEBUG === '1') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

/*
  Preloaded via `node -r`/`ts-node -r` BEFORE main.ts's own imports run (see
  package.json's start* scripts) - auto-instrumentation patches libraries
  (pg, ioredis, http, express) by wrapping their exports at require-time, so
  it must execute before anything else in the app requires those libraries.
  A static `import` at the top of main.ts would be too late, since Node
  resolves and evaluates static imports (including transitively-required
  DB/Redis clients) before main.ts's own body ever runs.
*/
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'replaydb-api',
  }),
  traceExporter: new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
      'http://localhost:4318/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void sdk.shutdown().finally(() => process.exit(0));
  });
}
