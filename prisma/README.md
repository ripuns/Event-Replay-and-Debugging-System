# prisma

Prisma ORM configuration: schema modeling and type-safe client generation for the Nest app. Prisma does **not** own database creation — `database/migrations/` (Flyway) does. This schema must stay reconciled with those SQL files (see [Migration Policy](../CONTEXT_SUMMARY.md)).

## Files

| File | Purpose | Why |
|---|---|---|
| `schema.prisma` | Defines `Organization`, `Project`, `Aggregate`, `Event`, `ApiKey`, `Snapshot`, `ReplayJob` models mapped onto the Flyway-created tables (`@map`/`@@map` to snake_case columns/tables), plus the `generator client` and `datasource db` blocks. | Gives the app a type-safe query layer over a schema that Flyway actually owns. Composite relations (`Event.aggregate`, `Snapshot.aggregate`, `ReplayJob.aggregate`) mirror the project-aware composite foreign keys from `V002`/`V003` so Prisma-level queries can't violate project isolation either. `generator client` sets `moduleFormat = "cjs"` because the rest of the compiled app is CommonJS (no `"type": "module"` in `package.json`) — without it, Prisma 7's default ESM output (`import.meta.url`) crashes at runtime under `require()`. |

`../prisma.config.ts` (repo root, not this folder) configures the Prisma CLI — schema path, migrations path, and the datasource URL loaded from `.env`.

## Regenerating the client

Run `npx prisma generate` after any schema change. Output goes to `src/generated/prisma/` (see that folder's own generated, unREADMEd nature — it's regenerated, never hand-edited).
