import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Queue } from 'bullmq';
import { Gauge } from 'prom-client';
import { QUEUE_DEPTH } from './metrics.providers';
import {
  SNAPSHOT_CREATION_QUEUE,
  REPLAY_JOBS_QUEUE,
} from '../../queues/queue-names';

const DEFAULT_POLL_INTERVAL_MS = 10_000;

function resolvePollIntervalMs(): number {
  const configured = Number(process.env.QUEUE_METRICS_POLL_INTERVAL_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_POLL_INTERVAL_MS;
}

/*
  BullMQ doesn't push queue-depth events, so the only way to expose it as a
  Prometheus gauge is to poll `getWaitingCount`/`getActiveCount` on an
  interval and set the gauge from the result - the gauge otherwise stays at
  whatever it was last set to between scrapes, which is fine since depth
  changes on the order of seconds, not milliseconds.
*/
@Injectable()
export class QueueMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueMetricsService.name);
  private intervalHandle?: NodeJS.Timeout;

  constructor(
    @InjectQueue(SNAPSHOT_CREATION_QUEUE) private readonly snapshotQueue: Queue,
    @InjectQueue(REPLAY_JOBS_QUEUE) private readonly replayJobsQueue: Queue,
    @InjectMetric(QUEUE_DEPTH) private readonly queueDepth: Gauge<string>,
  ) {}

  onModuleInit(): void {
    const pollIntervalMs = resolvePollIntervalMs();
    this.intervalHandle = setInterval(() => {
      void this.pollOnce();
    }, pollIntervalMs);
    this.intervalHandle.unref();
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }
  }

  private async pollOnce(): Promise<void> {
    try {
      await Promise.all([
        this.recordQueueDepth(SNAPSHOT_CREATION_QUEUE, this.snapshotQueue),
        this.recordQueueDepth(REPLAY_JOBS_QUEUE, this.replayJobsQueue),
      ]);
    } catch (error) {
      this.logger.warn(
        'Failed to poll queue depth for metrics',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async recordQueueDepth(
    queueName: string,
    queue: Queue,
  ): Promise<void> {
    const [waiting, active] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
    ]);
    this.queueDepth.set({ queue: queueName, state: 'waiting' }, waiting);
    this.queueDepth.set({ queue: queueName, state: 'active' }, active);
  }
}
