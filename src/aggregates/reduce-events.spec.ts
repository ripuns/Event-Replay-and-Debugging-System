import { EventReducerOperation } from 'src/event-reducers/dto/create-event-reducer.dto';
import { reduceEvents, ReducerRule, ReducibleEvent } from './reduce-events';

describe('reduceEvents', () => {
  it('applies a set operation by shallow-merging the payload into state root', () => {
    const events: ReducibleEvent[] = [
      { eventType: 'OrderPlaced', payload: { total: 100, status: 'placed' } },
    ];
    const rules: ReducerRule[] = [
      { eventType: 'OrderPlaced', operation: EventReducerOperation.Set, field: null },
    ];

    expect(reduceEvents(events, rules)).toEqual({
      total: 100,
      status: 'placed',
    });
  });

  it('applies a merge operation into a named sub-field, preserving other existing keys', () => {
    const events: ReducibleEvent[] = [
      { eventType: 'OrderPlaced', payload: { total: 100 } },
      { eventType: 'OrderShipped', payload: { carrier: 'UPS' } },
      { eventType: 'OrderShipped', payload: { trackingId: '1Z999' } },
    ];
    const rules: ReducerRule[] = [
      { eventType: 'OrderPlaced', operation:  EventReducerOperation.Set, field: null },
      { eventType: 'OrderShipped', operation:  EventReducerOperation.Merge, field: 'shipping' },
    ];

    expect(reduceEvents(events, rules)).toEqual({
      total: 100,
      shipping: { carrier: 'UPS', trackingId: '1Z999' },
    });
  });

  it('applies an append operation, accumulating payloads into an array field', () => {
    const events: ReducibleEvent[] = [
      { eventType: 'ItemAdded', payload: { sku: 'A1' } },
      { eventType: 'ItemAdded', payload: { sku: 'B2' } },
    ];
    const rules: ReducerRule[] = [
      { eventType: 'ItemAdded', operation:  EventReducerOperation.Append, field: 'items' },
    ];

    expect(reduceEvents(events, rules)).toEqual({
      items: [{ sku: 'A1' }, { sku: 'B2' }],
    });
  });

  it('skips events whose eventType has no matching rule instead of erroring', () => {
    const events: ReducibleEvent[] = [
      { eventType: 'OrderPlaced', payload: { total: 100 } },
      { eventType: 'UnmappedEvent', payload: { whatever: true } },
    ];
    const rules: ReducerRule[] = [
      { eventType: 'OrderPlaced', operation: EventReducerOperation.Set, field: null },
    ];

    expect(reduceEvents(events, rules)).toEqual({ total: 100 });
  });

  it('applies events in the given order, so later events can overwrite earlier set fields', () => {
    const events: ReducibleEvent[] = [
      { eventType: 'OrderPlaced', payload: { status: 'placed' } },
      { eventType: 'OrderCancelled', payload: { status: 'cancelled' } },
    ];
    const rules: ReducerRule[] = [
      { eventType: 'OrderPlaced', operation: EventReducerOperation.Set, field: null },
      { eventType: 'OrderCancelled', operation: EventReducerOperation.Set, field: null },
    ];

    expect(reduceEvents(events, rules)).toEqual({ status: 'cancelled' });
  });

  it('ignores a merge/append rule with no matching field configured', () => {
    const events: ReducibleEvent[] = [
      { eventType: 'ItemAdded', payload: { sku: 'A1' } },
    ];
    const rules: ReducerRule[] = [
      { eventType: 'ItemAdded', operation: EventReducerOperation.Append, field: null },
    ];

    expect(reduceEvents(events, rules)).toEqual({});
  });
});
