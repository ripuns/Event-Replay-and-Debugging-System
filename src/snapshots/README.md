# src/snapshots

Snapshot creation — Phase 6's performance optimization for aggregate reconstruction. A snapshot is a materialized `state` object at a known `sequenceNumber`, letting `AggregatesService.getState` (see `src/aggregates/README.md`) replay only the events *after* the snapshot instead of from the very first event every time. Snapshots are never the source of truth — deleting every snapshot changes nothing about correctness, only speed (see `CONTEXT_SUMMARY.md`'s "Redis is a performance layer, not system of record" rule, which applies identically to snapshots).

## Files

| File | Purpose | Why |
|---|---|---|
| `snapshots.service.ts` (`SnapshotsService`) | `shouldSnapshot(aggregateId)`: cheap synchronous check — has this aggregate accumulated ≥20 events since its last snapshot? Called from `EventsService.append`. `createSnapshot(projectId, aggregateId)`: calls `AggregatesService.getState(...)` to recompute current state, then persists it as a new `Snapshot` row. Returns `null` (not an error) if there's nothing new to snapshot — either because the aggregate has no events, or because a snapshot already exists at its current latest sequence number (checked via a pre-check *and* a caught `P2002` unique-constraint violation, since two concurrent triggers — e.g. the automatic threshold trigger and a manually requested replay job — can race to snapshot the same up-to-date aggregate). | The no-op path here is a real bug fix, not a preemptive guess: an early version always attempted `create`, which crashed with `Unique constraint failed on uq_snapshot_aggregate_sequence` when a replay job ran twice with no new events in between — found via live testing, not code review. |
| `snapshots.repository.ts` (`SnapshotsRepository`) | `findLatestUpTo(aggregateId, asOfSequence?)` — the query `AggregatesService.getState` uses to find its starting point. `findLatest(aggregateId)` — used by `shouldSnapshot`/`createSnapshot`'s race check. `create(...)`. `countEventsSince(aggregateId, afterSequence?)` — used by `shouldSnapshot`. | Plain Prisma wrapper, same layering as every other repository in this codebase. Provided directly (not just via `SnapshotsModule`) in `src/aggregates/aggregates.module.ts` too, to avoid a module import cycle (`AggregatesModule` needs `SnapshotsRepository`; `SnapshotsModule` needs `AggregatesModule` for `AggregatesService`) — see `src/aggregates/README.md`. |
| `snapshot-creation.processor.ts` (`SnapshotCreationProcessor`) | BullMQ `@Processor(SNAPSHOT_CREATION_QUEUE)` — pulls `{ projectId, aggregateId }` jobs and calls `SnapshotsService.createSnapshot`. Logs and rethrows on failure (so BullMQ's retry/failure tracking sees it), rather than swallowing errors silently. | This is where the actual snapshot *write* happens, off the HTTP request path — `EventsService.append` only decides whether to enqueue, never blocks on the write itself. |
| `snapshots.module.ts` (`SnapshotsModule`) | Imports `PrismaModule`, `AggregatesModule`, `QueuesModule`, registers the `SNAPSHOT_CREATION_QUEUE` queue; provides the service/repository/processor; exports `SnapshotsService` (consumed by `EventsModule` and `ReplayJobsModule`) and `BullModule` (so `EventsModule` can `@InjectQueue` directly). | |

## Snapshot creation trigger (design decision, confirmed with the user)

Snapshot creation is **queue-backed** (BullMQ + Redis), not synchronous-inline-with-append and not an in-process interval scanner — see `src/queues/README.md` for the full rationale. The decision to snapshot (the threshold check) stays synchronous and cheap on the append path; the actual write is fully decoupled. Threshold is `SNAPSHOT_EVENT_THRESHOLD = 20` events since the last snapshot, defined in `snapshots.service.ts`.

## Not built yet

- The threshold (20) is a hardcoded constant, not per-project configurable.
- No snapshot pruning/retention policy — old snapshots accumulate indefinitely. Since they're pure cache, this only costs storage, never correctness.
