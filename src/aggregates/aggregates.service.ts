import { Injectable, NotFoundException } from '@nestjs/common';
import { AggregatesRepository } from './aggregates.repository';
import { EventReducersService } from '../event-reducers/event-reducers.service';
import { SnapshotsRepository } from '../snapshots/snapshots.repository';
import { reduceEvents, ReducerRule } from './reduce-events';
import { EventReducerOperation } from '../event-reducers/dto/create-event-reducer.dto';
import { RedisCacheService } from '../cache/redis-cache.service';
import {
  aggregateStateCacheKey,
  snapshotLookupCacheKey,
} from '../cache/cache-keys';

const STATE_CACHE_TTL_SECONDS = 300;
const SNAPSHOT_LOOKUP_CACHE_TTL_SECONDS = 300;

export interface AggregateStateResult {
  aggregateId: string;
  aggregateType: string;
  aggregateKey: string;
  asOfSequence: string | null;
  state: Record<string, unknown>;
}

interface CachedSnapshotLookup {
  sequenceNumber: string;
  state: Record<string, unknown>;
}

@Injectable()
export class AggregatesService {
  constructor(
    private readonly aggregatesRepository: AggregatesRepository,
    private readonly eventReducersService: EventReducersService,
    private readonly snapshotsRepository: SnapshotsRepository,
    private readonly cache: RedisCacheService,
  ) {}

  async getState(
    projectId: string,
    aggregateId: string,
    asOfSequence?: string,
  ): Promise<AggregateStateResult> {
    const stateCacheKey = aggregateStateCacheKey(aggregateId, asOfSequence);
    const cachedState =
      await this.cache.get<AggregateStateResult>(stateCacheKey);
    if (cachedState) {
      return cachedState;
    }

    const aggregate = await this.aggregatesRepository.findForProject(
      aggregateId,
      projectId,
    );
    if (!aggregate) {
      throw new NotFoundException('Aggregate not found');
    }

    const asOfSequenceBigInt =
      asOfSequence !== undefined ? BigInt(asOfSequence) : undefined;

    // Start from the nearest snapshot at or before the requested point (if
    // any) rather than replaying every event from the beginning - this is
    // the actual performance payoff of snapshotting. Correctness never
    // depends on a snapshot existing: with none, this falls back to
    // replaying the full event history, same as before Phase 6.
    const snapshot = await this.getSnapshotLookup(
      aggregateId,
      asOfSequence,
      asOfSequenceBigInt,
    );

    const events = await this.aggregatesRepository.findEventsInRange(
      aggregateId,
      snapshot ? BigInt(snapshot.sequenceNumber) : undefined,
      asOfSequenceBigInt,
    );

    const rawRules = await this.eventReducersService.findAllForAggregateType(
      projectId,
      aggregate.aggregateType,
    );

    const rules: ReducerRule[] = rawRules
      .filter(
        (rule): rule is typeof rule & { operation: EventReducerOperation } =>
          Object.values(EventReducerOperation).includes(
            rule.operation as EventReducerOperation,
          ),
      )
      .map((rule) => ({
        eventType: rule.eventType,
        operation: rule.operation,
        field: rule.field,
      }));

    const initialState = snapshot?.state ?? {};
    const state = reduceEvents(events, rules, initialState);
    const lastEvent = events.at(-1);
    const asOf = lastEvent
      ? lastEvent.sequenceNumber.toString()
      : (snapshot?.sequenceNumber ?? null);

    const result: AggregateStateResult = {
      aggregateId: aggregate.id,
      aggregateType: aggregate.aggregateType,
      aggregateKey: aggregate.aggregateKey,
      asOfSequence: asOf,
      state,
    };

    await this.cache.set(stateCacheKey, result, STATE_CACHE_TTL_SECONDS);

    return result;
  }

  /**
   * Snapshot lookup, cached separately from the full reconstructed state.
   * Checked only on a state-cache miss, so a state-cache hit skips this
   * (and every DB call) entirely. On a state-cache miss, this still saves a
   * DB round-trip when the snapshot itself is already cached - the events
   * "after the snapshot" still get replayed fresh either way, since only the
   * snapshot row itself is cached here, not the folded result.
   */
  private async getSnapshotLookup(
    aggregateId: string,
    asOfSequence: string | undefined,
    asOfSequenceBigInt: bigint | undefined,
  ): Promise<{
    sequenceNumber: string;
    state: Record<string, unknown>;
  } | null> {
    const lookupCacheKey = snapshotLookupCacheKey(aggregateId, asOfSequence);
    const cached = await this.cache.get<CachedSnapshotLookup>(lookupCacheKey);
    if (cached) {
      return cached;
    }

    const snapshot = await this.snapshotsRepository.findLatestUpTo(
      aggregateId,
      asOfSequenceBigInt,
    );
    if (!snapshot) {
      return null;
    }

    const result: CachedSnapshotLookup = {
      sequenceNumber: snapshot.sequenceNumber.toString(),
      state: snapshot.state as Record<string, unknown>,
    };
    await this.cache.set(
      lookupCacheKey,
      result,
      SNAPSHOT_LOOKUP_CACHE_TTL_SECONDS,
    );

    return result;
  }
}
