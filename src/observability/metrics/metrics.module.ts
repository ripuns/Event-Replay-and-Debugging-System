import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import {
  httpRequestDurationSeconds,
  httpRequestsTotal,
  queueDepthGauge,
} from './metrics.providers';
import { QueueMetricsService } from './queue-metrics.service';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { QueuesModule } from '../../queues/queues.module';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true },
    }),
    QueuesModule,
  ],
  providers: [
    httpRequestsTotal,
    httpRequestDurationSeconds,
    queueDepthGauge,
    QueueMetricsService,
    HttpMetricsInterceptor,
  ],
  exports: [HttpMetricsInterceptor],
})
export class MetricsModule {}
