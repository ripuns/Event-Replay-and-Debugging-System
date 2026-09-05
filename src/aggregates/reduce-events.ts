import { EventReducerOperation } from '../event-reducers/dto/create-event-reducer.dto';

export interface ReducibleEvent {
  eventType: string;
  payload: unknown;
}

export interface ReducerRule {
  eventType: string;
  operation: EventReducerOperation;
  field: string | null;
}

/**
 * Folds a sequence of events into a single state object using per-eventType
 * rules. An event whose eventType has no matching rule is skipped (its
 * payload contributes nothing to state) rather than raising an error -
 * this keeps reconstruction total (never crashes on an unmapped event type)
 * while staying fully declarative and server-side.
 */
export function reduceEvents(
  events: ReducibleEvent[],
  rules: ReducerRule[],
): Record<string, unknown> {
  const rulesByEventType = new Map(rules.map((rule) => [rule.eventType, rule]));
  let state: Record<string, unknown> = {};

  for (const event of events) {
    const rule = rulesByEventType.get(event.eventType);
    if (!rule) continue;

    state = applyRule(state, rule, event.payload);
  }

  return state;
}

function applyRule(
  state: Record<string, unknown>,
  rule: ReducerRule,
  payload: unknown,
): Record<string, unknown> {
  switch (rule.operation) {
    case EventReducerOperation.Set: {
      if (!isPlainObject(payload)) return state;
      return { ...state, ...payload };
    }

    case EventReducerOperation.Merge: {
      if (!rule.field || !isPlainObject(payload)) return state;
      const existing = state[rule.field];
      const base = isPlainObject(existing) ? existing : {};
      return { ...state, [rule.field]: { ...base, ...payload } };
    }

    case EventReducerOperation.Append: {
      if (!rule.field) return state;
      const existing = state[rule.field];
      const list: unknown[] = Array.isArray(existing)
        ? (existing as unknown[])
        : [];
      return { ...state, [rule.field]: [...list, payload] };
    }

    default:
      return state;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
