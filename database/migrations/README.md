# database/migrations

Flyway SQL migrations — the source of truth for the PostgreSQL schema. `prisma/schema.prisma` must be kept reconciled with whatever these files define; Prisma never owns schema creation (see [Migration Policy](../../CONTEXT_SUMMARY.md)).

Applied automatically by the `flyway` service in `docker-compose.yml` against the `postgres` container on `docker compose up`.

## Files

| File | Purpose | Why |
|---|---|---|
| `V001__create_core_tables.sql` | Creates `organizations`, `projects`, `aggregates`, `events` with their base foreign keys, unique constraints (`project + aggregate_type + aggregate_key`, `aggregate + sequence_number`), and lookup indexes. | Establishes the core tenant → project → aggregate → event hierarchy that everything else in the system hangs off. |
| `V002__enforce_project_aggregate_isolation.sql` | Adds `UNIQUE (id, project_id)` on `aggregates`, then swaps `events`' FK to a composite `(aggregate_id, project_id) → aggregates(id, project_id)`. | Makes it impossible at the database level for an event to reference an aggregate outside its own project — project isolation can't be bypassed by application-layer bugs. |
| `V003__create_api_keys_snapshots_replay_jobs.sql` | Creates `api_keys` (project-scoped, hashed secret only), `snapshots` (aggregate-scoped, same composite-FK isolation pattern as V002), and `replay_jobs` (project-scoped, optional aggregate target, also composite-FK isolated). | Completes the Phase 2 data model. `snapshots`/`replay_jobs` reuse V002's project-aware composite FK pattern so every table that hangs off an aggregate gets the same tenant-isolation guarantee, not just `events`. |

## Rules for adding new migrations

- Never edit a migration once applied in a shared environment — add a new `V00N__description.sql` file instead (Flyway policy, enforced by convention here, not tooling).
- Any new table referencing an aggregate must use the composite `(aggregate_id, project_id)` FK pattern from V002/V003, not a bare `aggregate_id` FK.
