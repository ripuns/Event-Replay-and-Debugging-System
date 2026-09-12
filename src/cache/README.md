# src/cache

Application-level Redis caching (Phase 7) — a plain `ioredis` client wrapped for use by `AggregatesService`/`EventsService`/`SnapshotsService`, distinct from BullMQ's own Redis connections in `src/queues` (different purpose, different client instances, same underlying Redis server).

## Files

| File | Purpose | Why |
|---|---|---|
| `redis-cache.service.ts` (`RedisCacheService`, `REDIS_CLIENT`) | `get<T>(key)` (JSON-deserializes, returns `null` on miss or any error), `set(key, value, ttlSeconds?)` (JSON-serializes, optional `EX` TTL), `del(...keys)`. Every method fails open — a Redis error is logged and treated as a cache miss/no-op, never thrown — because the cache is a pure optimization; Postgres remains the source of truth, exactly the same principle already applied to snapshots (see `src/snapshots/README.md`). Implements `OnModuleDestroy` to `redis.quit()` cleanly. | A thin wrapper rather than `@nestjs/cache-manager` or similar: this phase needs precise control over key structure and *which* keys get invalidated when — a generic cache abstraction would hide exactly the mechanics that matter here. |
| `cache-keys.ts` | `aggregateStateCacheKey(aggregateId, asOfSequence?)` and `snapshotLookupCacheKey(aggregateId, asOfSequence?)` — build a key like `aggregate-state:{id}:latest` or `aggregate-state:{id}:seq:{N}`. `aggregateStateLatestKey`/`snapshotLookupLatestKey` are convenience aliases for the no-`asOfSequence` (i.e. `:latest`) case, used at invalidation call sites so the "which key am I deleting" intent reads clearly without re-deriving it from the general key builder. | Centralizing key construction in one file means the producer side (`AggregatesService`, writing cache entries) and the invalidation side (`EventsService`, `SnapshotsService`, deleting them) can never drift out of sync on key naming — a typo in either would silently break invalidation instead of erroring. |
| `cache.module.ts` (`CacheModule`) | Provides `REDIS_CLIENT` via a factory (`new Redis(process.env.REDIS_URL!)`) and `RedisCacheService`; exports the service. | Reads `REDIS_URL` directly from `process.env`, same pattern as `QueuesModule` (see `src/queues/README.md`) and `common/auth/auth.module.ts` — not through `ConfigService`. |

## Design decisions (confirmed with the user)

**Two cache layers, not one:**
1. **Full reconstructed state** (`aggregate-state:{id}:latest` / `:seq:{N}`) — the entire `AggregateStateResult` from `AggregatesService.getState`. Checked first; a hit skips the database entirely.
2. **Snapshot lookup** (`snapshot-lookup:{id}:latest` / `:seq:{N}`) — just the `Snapshot` row `SnapshotsRepository.findLatestUpTo` would have returned. Checked only on a state-cache miss, saving one DB round-trip before falling through to the full reconstruction path (snapshot lookup + event replay).

**Invalidation is explicit, not TTL-only** (though both layers also carry a 300s TTL as a defense-in-depth backstop, never the primary correctness mechanism):
- `EventsService.append` deletes both `:latest` keys for the aggregate immediately after a new event commits — never the `:seq:{N}` keys, since a historical point-in-time is immutable by definition once it exists (an `asOfSequence=15` query gives the same answer today and forever, no matter how many later events arrive).
- `SnapshotsService.createSnapshot` deletes both `:latest` keys again after successfully writing a *new* snapshot — this matters even though the triggering append usually already invalidated them, because a snapshot can also be created by a replay job (`src/replay-jobs`) with no new event as the trigger.

**Why two layers don't increase staleness risk over one**: both layers' `:latest` keys are invalidated at the same trigger points, so the moment an event lands, both are gone together — the next read is a full miss on both, going all the way to Postgres for a truly current answer. Layer 2 being invalidated less often than Layer 1 in absolute terms (new snapshots are rarer than new events) is intentional and harmless: `getState` always replays events *on top of* whatever the snapshot lookup returns, whether that snapshot came from cache or DB, so an "older" cached snapshot combined with a fresh event replay still produces a fully correct final state.
