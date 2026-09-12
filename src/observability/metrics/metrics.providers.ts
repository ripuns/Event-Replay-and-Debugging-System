import {
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';

export const HTTP_REQUESTS_TOTAL = 'http_requests_total';
export const HTTP_REQUEST_DURATION_SECONDS = 'http_request_duration_seconds';
export const QUEUE_DEPTH = 'queue_depth';

export const httpRequestsTotal = makeCounterProvider({
  name: HTTP_REQUESTS_TOTAL,
  help: 'Total number of HTTP requests handled, labeled by method/route/status code',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDurationSeconds = makeHistogramProvider({
  name: HTTP_REQUEST_DURATION_SECONDS,
  help: 'HTTP request duration in seconds, labeled by method/route/status code',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const queueDepthGauge = makeGaugeProvider({
  name: QUEUE_DEPTH,
  help: 'Number of jobs currently waiting or active in a BullMQ queue, labeled by queue name and state',
  labelNames: ['queue', 'state'],
});
