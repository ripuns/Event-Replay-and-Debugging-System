import { Injectable, Logger } from '@nestjs/common';
import { SnapshotsRepository } from './snapshots.repository';
import { AggregatesService } from '../aggregates/aggregates.service';
import { Prisma } from '../generated/prisma/client';
import { RedisCacheService } from '../cache/redis-cache.service';
import {
  aggregateStateLatestKey,
  snapshotLookupLatestKey,
} from '../cache/cache-keys';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

const SNAPSHOT_EVENT_THRESHOLD = 20;

@Injectable()
export class SnapshotsService {
  private readonly logger = new Logger(SnapshotsService.name);

  constructor(
    private readonly snapshotsRepository: SnapshotsRepository,
    private readonly aggregatesService: AggregatesService,
    private readonly cache: RedisCacheService,
  ) {}

  /**
   * Cheap, synchronous check: has this aggregate accumulated enough events
   * since its last snapshot to be worth snapshotting again? Called from the
   * event-append path; the actual snapshot write happens asynchronously via
   * the snapshot-creation queue, not on this call path.
   */
  async shouldSnapshot(aggregateId: string): Promise<boolean> {
    const latest = await this.snapshotsRepository.findLatest(aggregateId);
    const eventsSinceLastSnapshot =
      await this.snapshotsRepository.countEventsSince(
        aggregateId,
        latest?.sequenceNumber,
      );

    return eventsSinceLastSnapshot >= SNAPSHOT_EVENT_THRESHOLD;
  }

  /**
   * Recomputes and persists a fresh snapshot at the aggregate's current
   * (latest) state. Idempotent in effect: if events arrive between the
   * decision to snapshot and this running, the snapshot simply reflects a
   * later sequence number than originally intended - never incorrect, just
   * possibly "ahead" of the triggering event.
   *
   * A no-op (returns null, not an error) if a snapshot already exists at the
   * aggregate's current latest sequence number - e.g. two triggers racing to
   * snapshot the same up-to-date aggregate (an automatic threshold trigger
   * and a manually requested replay job, or two replay jobs back to back).
   * There is nothing new to capture, so this isn't a failure.
   */
  async createSnapshot(projectId: string, aggregateId: string) {
    const result = await this.aggregatesService.getState(
      projectId,
      aggregateId,
    );

    if (result.asOfSequence === null) {
      this.logger.warn(
        `Skipping snapshot for aggregate ${aggregateId}: no events found`,
      );
      return null;
    }

    const sequenceNumber = BigInt(result.asOfSequence);
    const latest = await this.snapshotsRepository.findLatest(aggregateId);
    if (latest && latest.sequenceNumber >= sequenceNumber) {
      return null;
    }

    try {
      const snapshot = await this.snapshotsRepository.create({
        aggregateId,
        projectId,
        sequenceNumber,
        state: result.state as Prisma.InputJsonValue,
      });

      // A new snapshot changes what "the latest snapshot" is, so the
      // snapshot-lookup cache must be invalidated even though the state
      // cache was typically already invalidated by the triggering append.
      await this.cache.del(
        snapshotLookupLatestKey(aggregateId),
        aggregateStateLatestKey(aggregateId),
      );

      return snapshot;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        // Another concurrent trigger already snapshotted this exact
        // sequence number between our check and this write - benign race,
        // not a failure.
        return null;
      }
      throw error;
    }
  }
}
