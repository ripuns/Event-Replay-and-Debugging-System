import { Injectable, NotFoundException } from '@nestjs/common';
import { AggregatesRepository } from './aggregates.repository';
import { EventReducersService } from '../event-reducers/event-reducers.service';
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

    const events = await this.aggregatesRepository.findEventsUpTo(
      aggregateId,
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

    const state = reduceEvents(events, rules);
    const lastEvent = events.at(-1);

    return {
      aggregateId: aggregate.id,
      aggregateType: aggregate.aggregateType,
      aggregateKey: aggregate.aggregateKey,
      asOfSequence: lastEvent ? lastEvent.sequenceNumber.toString() : null,
      state,
    };
  }
}
