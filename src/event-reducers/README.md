# src/event-reducers

Per-`aggregateType`+`eventType` configuration declaring how an event's payload folds into aggregate state. This is the "custom reduction logic" backing Phase 5's aggregate-reconstruction feature (see `src/aggregates/README.md`) — a project registers rules here once, and `AggregatesService` applies them at reconstruction time.

## Why this exists (design rationale)

Aggregate reconstruction needs to turn an arbitrary sequence of business events into one state object, but the server has no inherent knowledge of what `OrderPlaced` or `InventoryReserved` *mean*. Three approaches were considered:

1. **A single generic rule** (e.g. always shallow-merge every payload) — rejected: wrong for a system whose whole premise is arbitrary business events: an `ItemAdded` event should usually accumulate into a list, not overwrite a single field.
2. **User-supplied sandboxed reducer code**, executed server-side per aggregate type — rejected for this phase: correctly sandboxing arbitrary code execution (isolated runtime, resource limits, security review) is a much bigger subsystem than "finish Phase 5," and violates "avoid over-engineering" / "don't implement large features before the data model is settled."
3. **Small declarative per-eventType rules** (this module) — chosen: fully server-side, genuinely custom per event type, and bounded in scope (a lookup table + three interpreted operations), with no code execution involved.

## Files

| File | Purpose | Why |
|---|---|---|
| `event-reducers.controller.ts` (`EventReducersController`) | `POST /v1/projects/:id/event-reducers` — declares (or replaces, since it's an upsert) the rule for one `(aggregateType, eventType)` pair. `GET /v1/projects/:id/event-reducers` — lists every rule for a project. Both guarded by `ApiKeyGuard` + `ProjectAccessGuard`. | Thin controller, delegates to `EventReducersService`. |
| `event-reducers.service.ts` (`EventReducersService`) | `upsert(projectId, dto)`, `findAllForProject(projectId)`, `findAllForAggregateType(projectId, aggregateType)` — the last one is what `AggregatesService` calls during reconstruction. | Thin pass-through to the repository; kept as its own layer for consistency with every other module and so `AggregatesModule` can depend on it without reaching into the repository directly. |
| `event-reducers.repository.ts` (`EventReducersRepository`) | `upsert(...)` via Prisma's `upsert` keyed on the `(projectId, aggregateType, eventType)` unique constraint; `findAllForProject`/`findAllForAggregateType` as plain `findMany`. | One rule per `(aggregateType, eventType)` pair per project — re-declaring a rule replaces it rather than erroring, so iterating on reduction logic during development doesn't require a delete step first. |
| `event-reducers.module.ts` (`EventReducersModule`) | Imports `PrismaModule`, `ApiKeyModule`; provides the service/repository/guards; registers the controller; exports `EventReducersService` (imported by `AggregatesModule`). | Standard layering, consistent with every other domain module in this codebase. |
| `dto/create-event-reducer.dto.ts` (`CreateEventReducerDto`, `EventReducerOperation`) | `aggregateType` (string, max 100), `eventType` (string, max 255), `operation` (enum: `set`/`merge`/`append`), `field` (string, max 255 — conditionally **required** for `merge`/`append` and ignored for `set`, enforced via `@ValidateIf`). | The conditional `field` requirement is the one piece of cross-field validation logic in this DTO — `merge`/`append` are meaningless without a target field, but `set` operates on the whole state root and has none. Getting this wrong would let a malformed rule silently no-op during reconstruction instead of being rejected at declaration time. |

## Operation vocabulary (v1)

- **`set`** — shallow-merges the event's payload directly into the state root. No `field`.
- **`merge`** — shallow-merges the event's payload into `state[field]` (creating the sub-object if it doesn't exist yet).
- **`append`** — pushes the event's payload (whole payload, not a sub-field of it) onto the array at `state[field]` (creating the array if it doesn't exist yet).

`increment` (add a numeric payload value to a numeric state field) and `remove` (remove an array entry by matching a key) were considered but deferred — more useful but with more edge cases (missing field, type mismatches) than the first version needed to cover.

An event whose `(aggregateType, eventType)` has no registered rule is **silently skipped** during reconstruction, not an error — see `src/aggregates/reduce-events.ts`.
