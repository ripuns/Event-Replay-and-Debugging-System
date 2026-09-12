import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import {
  HTTP_REQUESTS_TOTAL,
  HTTP_REQUEST_DURATION_SECONDS,
} from './metrics.providers';

/*
  Records one counter increment + one histogram observation per HTTP request.
  Route is read from `request.route.path` (the matched Express route pattern,
  e.g. "/v1/projects/:id/events") rather than `request.url`, so requests to
  the same endpoint with different path params collapse into one label
  combination instead of creating unbounded metric cardinality.
*/
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric(HTTP_REQUESTS_TOTAL)
    private readonly requestsTotal: Counter<string>,
    @InjectMetric(HTTP_REQUEST_DURATION_SECONDS)
    private readonly requestDuration: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = process.hrtime.bigint();

    const record = () => {
      const matchedRoute = request.route as { path?: string } | undefined;
      const route = matchedRoute?.path ?? request.path;
      const labels = {
        method: request.method,
        route,
        status_code: String(response.statusCode),
      };
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      this.requestsTotal.inc(labels);
      this.requestDuration.observe(labels, durationSeconds);
    };

    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
