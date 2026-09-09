# src/queues

Shared BullMQ (Redis-backed) infrastructure — the first real use of the Redis container in this codebase, introduced for Phase 6 (snapshots + replay jobs) rather than waiting for Phase 7's caching work, since both need the same job-queue primitive.

## Files

| File | Purpose | Why |
|---|---|---|
| `queue-names.ts` | Exports `SNAPSHOT_CREATION_QUEUE` and `REPLAY_JOBS_QUEUE` string constants. | Single source of truth for queue names, used by both the producer side (`@InjectQueue`) and consumer side (`@Processor`) across different modules — a typo in either would silently create two disconnected queues instead of erroring. |
| `queues.module.ts` (`QueuesModule`) | `BullModule.forRoot({ connection: { url: process.env.REDIS_URL } })` plus `BullModule.registerQueue(...)` for both queues; exports `BullModule` so importers can inject `Queue` instances. | Reads `REDIS_URL` directly from `process.env` (not `ConfigService`) to match the existing pattern in `common/auth/auth.module.ts` (`JwtModule.register({ secret: process.env.JWT_SECRET })`) rather than introducing an untested `ConfigService`-based path. `forRoot` (not `forRootAsync`) is sufficient since the connection string is available synchronously at module-eval time. |

## Design decision (confirmed with the user)

Snapshot creation is deliberately **not** synchronous/inline with event append, and **not** a simple in-process interval scanner — it's a genuine queue-backed background worker (BullMQ), even though this adds real infrastructure (a new dependency, `ioredis` as BullMQ's required peer, a queue connection to manage) to what could have been a much smaller feature. This was an explicit tradeoff: production-realistic background processing now, reused identically by both `snapshots` (Phase 6) and any future Phase 7 caching work, instead of building a throwaway scheduler that would need replacing later.

## Runtime dependency note

BullMQ requires `ioredis` as an installed peer dependency for its `Worker` class — omitting it fails silently at Worker construction time with a clear error (`BullMQ could not load the optional 'ioredis' package`), not at `npm install` time. Both `bullmq` and `ioredis` are direct dependencies here specifically because of that.
