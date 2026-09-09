import { Injectable, NotFoundException } from '@nestjs/common';
import { AggregatesRepository } from './aggregates.repository';
import { EventReducersService } from '../event-reducers/event-reducers.service';
import { SnapshotsRepository } from '../snapshots/snapshots.repository';
import { reduceEvents, ReducerRule } from './reduce-events';
import { EventReducerOperation } from '../event-reducers/dto/create-event-reducer.dto';

export interface AggregateStateResult {
  aggregateId: string;
  aggregateType: string;
  aggregateKey: string;
  asOfSequence: string | null;
  state: Record<string, unknown>;
}

@Injectable()
export class AggregatesService {
  constructor(
    private readonly aggregatesRepository: AggregatesRepository,
    private readonly eventReducersService: EventReducersService,
    private readonly snapshotsRepository: SnapshotsRepository,
  ) {}

  async getState(
    projectId: string,
    aggregateId: string,
    asOfSequence?: string,
  ): Promise<AggregateStateResult> {
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
    const snapshot = await this.snapshotsRepository.findLatestUpTo(
      aggregateId,
      asOfSequenceBigInt,
    );

    const events = await this.aggregatesRepository.findEventsInRange(
      aggregateId,
      snapshot?.sequenceNumber,
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

    const initialState = snapshot
      ? (snapshot.state as Record<string, unknown>)
      : {};
    const state = reduceEvents(events, rules, initialState);
    const lastEvent = events.at(-1);
    const asOf = lastEvent
      ? lastEvent.sequenceNumber.toString()
      : (snapshot?.sequenceNumber.toString() ?? null);

    return {
      aggregateId: aggregate.id,
      aggregateType: aggregate.aggregateType,
      aggregateKey: aggregate.aggregateKey,
      asOfSequence: asOf,
      state,
    };
  }
}
