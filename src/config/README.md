# src/config

Typed env-var loader functions, registered with `ConfigModule.forRoot({ load: [...] })` in `app.module.ts`. Each file returns a factory function producing one namespaced config slice, retrievable via `ConfigService.get('namespace.key')`.

## Files

| File | Purpose | Why |
|---|---|---|
| `app.config.ts` | `app.port` (from `PORT`, default `3000`), `app.env` (from `NODE_ENV`, default `development`). | Central place for general app-level settings instead of reading `process.env` ad hoc in controllers/services. |
| `auth.config.ts` | `auth.jwtSecret` (from `JWT_SECRET`), `auth.jwtExpiresIn` (from `JWT_EXPIRES_IN`, default `1h`). | Feeds the JWT scaffolding in `common/auth` (currently unused — API keys are the active auth mechanism — but kept configured since the JWT strategy still reads `JWT_SECRET` directly from `process.env`). |
| `database.config.ts` | `database.url`/`host`/`port`/`name`/`user`/`password` from the corresponding `DB_*`/`DATABASE_URL` env vars. | `PrismaService` currently reads `DATABASE_URL` straight from `process.env` rather than through this config slice — kept here for consistency and in case future code needs the individual host/port/name/user/password fields (e.g. tooling that can't take a single connection string). |
| `redis.config.ts` | `redis.url`/`host`/`port` from `REDIS_URL`/`REDIS_HOST`/`PORT`. | Placeholder for the Phase 7 Redis caching layer (not yet implemented) — Redis is a performance layer only, never the source of record. |

All four are loaded in `app.module.ts`'s `ConfigModule.forRoot({ load: [...] })`; the module's own `validateEnv` function enforces that `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET` are present at boot.
