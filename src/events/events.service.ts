import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventsRepository } from './events.repository';
import { PrismaService } from '../prisma/prisma.service';
import { SnapshotsService } from '../snapshots/snapshots.service';
import { SNAPSHOT_CREATION_QUEUE } from '../queues/queue-names';
import type { SnapshotCreationJobData } from '../snapshots/snapshot-creation.processor';
import type { Prisma } from '../generated/prisma/client';
import { RedisCacheService } from '../cache/redis-cache.service';
import {
  aggregateStateLatestKey,
  snapshotLookupLatestKey,
} from '../cache/cache-keys';

export interface AppendEventInput {
  aggregateType: string;
  aggregateKey: string;
  eventType: string;
  eventVersion: number;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly eventsRepository: EventsRepository,
    private readonly prisma: PrismaService,
    private readonly snapshotsService: SnapshotsService,
    private readonly cache: RedisCacheService,
    @InjectQueue(SNAPSHOT_CREATION_QUEUE)
    private readonly snapshotQueue: Queue<SnapshotCreationJobData>,
  ) {}

  async append(projectId: string, input: AppendEventInput) {
    const event = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const aggregate =
          await this.eventsRepository.findOrCreateAggregateForUpdate(
            tx,
            projectId,
            input.aggregateType,
            input.aggregateKey,
          );

        const sequenceNumber = await this.eventsRepository.nextSequenceNumber(
          tx,
          aggregate.id,
        );

        return this.eventsRepository.createEvent(tx, {
          projectId,
          aggregateId: aggregate.id,
          sequenceNumber,
          eventType: input.eventType,
          eventVersion: input.eventVersion,
          payload: input.payload as Prisma.InputJsonValue,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
          occurredAt: input.occurredAt
            ? new Date(input.occurredAt)
            : new Date(),
        });
      },
    );

    await this.cache.del(
      aggregateStateLatestKey(event.aggregateId),
      snapshotLookupLatestKey(event.aggregateId),
    );

    await this.maybeEnqueueSnapshot(projectId, event.aggregateId);

    return { ...event, sequenceNumber: event.sequenceNumber.toString() };
  }

  /**
   * Enqueues a background snapshot job when the aggregate has accumulated
   * enough events since its last snapshot. The check itself is cheap and
   * synchronous; the actual snapshot write happens off the request path in
   * SnapshotCreationProcessor. A queue failure here must never fail the
   * append itself - snapshots are a pure optimization, never the source of
   * truth.
   */
  private async maybeEnqueueSnapshot(
    projectId: string,
    aggregateId: string,
  ): Promise<void> {
    try {
      const shouldSnapshot =
        await this.snapshotsService.shouldSnapshot(aggregateId);
      if (shouldSnapshot) {
        await this.snapshotQueue.add('create-snapshot', {
          projectId,
          aggregateId,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to enqueue snapshot creation for aggregate ${aggregateId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
