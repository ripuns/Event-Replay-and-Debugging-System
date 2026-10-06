# ReplayDB

ReplayDB is an event-sourcing backend platform: it captures application events as an immutable, append-only log and reconstructs application state — current or at any past point in time — by replaying those events through a declarative, server-side rules engine. Built to investigate production incidents, audit historical behavior, and demonstrate production-grade backend architecture (project isolation, caching, async job processing, observability) end to end.

Events are the source of truth. Everything else — reconstructed state, snapshots, caches — is derived and can be regenerated from the event log at any time.

---

## Architecture

```
                    Client Applications
                            │
                            ▼
                    NestJS REST API  ──────────────┐
                            │                       │
          ┌─────────────────┼──────────────┐        │
          ▼                 ▼              ▼        ▼
     PostgreSQL          Redis          BullMQ    OpenTelemetry
  (event store,      (state/snapshot   (async     + Jaeger
   system of           cache,          snapshot/   (tracing)
   record)             queue           replay job
                        backend)        workers)
                                                      │
                                                      ▼
                                              Prometheus (/v1/metrics)
```

Core domain hierarchy:

```
Organization
    └── Project
            ├── API Keys
            ├── Aggregates
            │       ├── Events        (immutable, append-only)
            │       └── Snapshots     (derived, optimization only)
            ├── Event Reducers        (declarative fold rules)
            └── Replay Jobs           (async bulk reconstruction)
```

**How reconstruction works:** a client registers a small declarative rule per `(aggregateType, eventType)` pair — `set`, `merge`, or `append` — describing how that event type folds into state. Appending an event is pure storage: no logic runs. Reconstructing state (`GET .../aggregates/:id/state`) replays the aggregate's events through those rules entirely server-side, optionally up to a specific sequence number for point-in-time ("time travel") debugging. Once an aggregate accumulates enough events, a background worker materializes a snapshot so later reconstructions replay only the events since that snapshot instead of the full history.

This is a single NestJS application (a modular monolith), not a microservices architecture — the "services" in the diagram above are infrastructure dependencies (database, cache, queue backend, tracing collector), not separately deployed application services.

---

## Technology stack

| Component | Technology |
|---|---|
| Runtime | Node.js (v24) |
| Framework | NestJS 11 |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma 7 |
| Database migrations | Flyway |
| Cache | Redis (two-layer: reconstructed state + snapshot lookup) |
| Background jobs | BullMQ (Redis-backed) — snapshot creation, bulk replay jobs |
| Authentication | Project-scoped API keys (SHA-256 hashed, never stored raw). JWT scaffolding exists in `src/common/auth/` but is not wired into any route — API keys are the only active auth mechanism. |
| API documentation | Swagger / OpenAPI |
| Validation | class-validator, class-transformer |
| Metrics | Prometheus (`@willsoto/nestjs-prometheus`) — HTTP request counters/latency, queue depth |
| Tracing | OpenTelemetry (auto-instrumented HTTP/Postgres/Redis), exported to a local Jaeger container |
| Logging | Structured JSON logs (Nest's built-in `ConsoleLogger`), per-request correlation IDs |
| Testing | Jest — unit specs + real end-to-end tests against live Postgres/Redis/BullMQ (no mocking) |
| Containerization | Docker Compose (local infra: Postgres, Redis, Flyway, Jaeger). No application Dockerfile yet — see [Project Status](#project-status). |

---

## Prerequisites

- Node.js (v22+ recommended; developed against v24)
- npm
- Docker Desktop (runs Postgres, Redis, Flyway, and Jaeger locally)
- Git

---

## Local development

### 1. Clone and install

```bash
git clone <repository-url>
cd Event-Replay-and-Debugging-System
npm install
```

### 2. Configure environment variables

There is no `.env.example` committed yet. Create `.env` in the project root with:

```bash
PORT=3000
DATABASE_URL="postgresql://replaydb:replaydb@localhost:5433/replaydb?schema=public"
REDIS_URL=redis://localhost:6379
JWT_SECRET=<any-random-string>
JWT_EXPIRES_IN=1h
FLYWAY_URL=jdbc:postgresql://localhost:5433/replaydb
FLYWAY_USER=replaydb
FLYWAY_PASSWORD=replaydb
```

`JWT_SECRET` is required at boot (the app fails fast if it's missing) even though JWT auth itself isn't active on any route today.

### 3. Start local infrastructure

```bash
docker compose up -d
docker compose ps
```

This starts Postgres (port 5433), Redis (6379), Jaeger (UI on 16686, OTLP on 4317/4318), and runs Flyway migrations once via a one-shot container (check `docker compose logs flyway` to confirm they applied).

### 4. Generate the Prisma client

```bash
npx prisma generate
```

### 5. Start the application

Development mode (auto-reload on file changes):

```bash
npm run start:dev
```

Production-style (compiled, no `ts-node`):

```bash
npm run build
npm run start:prod
```

The API is available at `http://localhost:3000`, Swagger docs at `http://localhost:3000/v1/docs`.

### Seeing it work

1. `POST /v1/organizations` with `{ "name": "...", "firstProject": { "name": "..." } }` — the only unauthenticated route; bootstraps an org, project, and API key in one call.
2. Use the returned key as `Authorization: Bearer <key>` for everything else.
3. `POST /v1/projects/:id/events` to append events, `POST /v1/projects/:id/event-reducers` to register fold rules, `GET /v1/projects/:id/aggregates/:aggregateId/state` to reconstruct state (add `?asOfSequence=N` for a point-in-time view).
4. `GET /v1/metrics` for Prometheus metrics; `http://localhost:16686` (Jaeger UI) for request traces once you've made a few calls.

---

## API surface

All routes are under the `/v1` prefix.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/v1/organizations` | Bootstrap an organization (+ optional first project and API key). Unauthenticated. |
| `GET` | `/v1/organizations/:id` | Fetch an organization. |
| `POST` | `/v1/organizations/:orgId/projects` | Create an additional project in an org. |
| `GET` | `/v1/projects/:id` | Fetch a project. |
| `POST` | `/v1/projects/:id/api-keys` | Mint an additional API key for a project. |
| `POST` | `/v1/projects/:id/events` | Append an event to an aggregate (auto-creates the aggregate on first event). |
| `POST` | `/v1/projects/:id/event-reducers` | Register a fold rule (`set`/`merge`/`append`) for an event type. |
| `GET` | `/v1/projects/:id/event-reducers` | List registered fold rules. |
| `GET` | `/v1/projects/:id/aggregates/:aggregateId/state` | Reconstruct an aggregate's state, optionally `?asOfSequence=N`. |
| `POST` | `/v1/projects/:id/replay-jobs` | Trigger a bulk/async replay job (optionally scoped to an aggregate type). |
| `GET` | `/v1/projects/:id/replay-jobs/:jobId` | Poll a replay job's status/result. |
| `GET` | `/v1/health` | Liveness check. |
| `GET` | `/v1/health/ready` | Readiness check — actively pings Postgres and Redis, returns 503 if either is unreachable. |
| `GET` | `/v1/metrics` | Prometheus metrics endpoint. |

Every route except organization bootstrap and health/metrics requires `Authorization: Bearer <api-key>`; keys are project-scoped and cannot read or write across project boundaries (enforced at both the guard and database level).

---

## Available commands

| Command | Description |
|---|---|
| `npm run start` | Start the app (compiled-on-the-fly via ts-node, with tracing preloaded) |
| `npm run start:dev` | Start with file-watch auto-reload |
| `npm run start:debug` | Start with auto-reload and the Node inspector attached |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start:prod` | Run the compiled build (`node dist/main`) |
| `npm run lint` | Run ESLint (auto-fix) |
| `npm run format` | Run Prettier |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:cov` | Unit tests with coverage |
| `npm run test:e2e` | Run end-to-end tests against real Postgres/Redis/BullMQ (requires `docker compose up -d`) |

---

## Database commands

```bash
# Apply pending Flyway migrations (also runs automatically via docker compose)
docker compose up -d flyway

# Regenerate the Prisma client after a schema change
npx prisma generate
```

Flyway SQL migrations (`database/migrations/`) are the source of truth for schema; `prisma/schema.prisma` is kept manually in sync with them — see `database/migrations/README.md` and `prisma/README.md`.

---

## Project status

Built in phases, each gated on full completion (design discussion → implementation → live verification → documentation) before moving to the next:

- **Done**: core event store, project/org/API-key auth with full isolation, declarative event-reducer reconstruction, point-in-time replay, async snapshot creation (BullMQ), bulk replay jobs, two-layer Redis caching with explicit invalidation, structured logging, Prometheus metrics, OpenTelemetry tracing (Jaeger), readiness/liveness health checks.
- **Deliberately deferred, not forgotten**: JWT/human-login auth (API keys are the only active auth mechanism by design for this phase).
- **Known issue**: one e2e test (`snapshots-and-replay-jobs.e2e-spec.ts`) can intermittently flake *only* when the full e2e suite runs together, due to a test-infrastructure artifact (stale BullMQ worker connections across the many separate app instances each test file boots) — not a product bug; every individual feature is independently verified working. See `test/README.md`'s "Known issue" section.
- **Not yet built**: CI/CD pipeline, an application Dockerfile/container image, a formal deployment plan, and environment promotion strategy — the next phase of work.

Every module under `src/` has its own `README.md` documenting what it does and why; start at `src/README.md`.
