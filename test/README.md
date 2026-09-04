# test

End-to-end (e2e) tests — boot the full Nest app (`AppModule`) and hit real HTTP routes via `supertest`, as opposed to the isolated unit specs colocated with their modules (e.g. `src/modules/health/health.controller.spec.ts`).

## Files

| File | Purpose | Why |
|---|---|---|
| `health.e2e-spec.ts` | Boots the app with the global `/v1` prefix and asserts `GET /v1/health` returns `{ status: 'ok', service: 'replaydb-api', timestamp }`. | Confirms the app actually starts end-to-end (config validation, module wiring, DI graph) — not just that individual units work in isolation. |
| `organization.e2e-spec.ts` | Boots the app and hits real `/v1/organizations` routes against the live Postgres from `.env`'s `DATABASE_URL`: creating an org with a bootstrapped `firstProject`+API key, creating a bare org (no `firstProject`), and confirming `GET /v1/organizations/:id` is rejected without a valid key. Cleans up every org (and cascaded projects/keys) it creates in `afterEach` via `PrismaService`. | Verifies the atomic org+project+key bootstrap transaction actually persists correctly and that the `ApiKeyGuard`/org-id check on `GET /v1/organizations/:id` works against a real database, not just in isolation. |
| `projects.e2e-spec.ts` | Boots the app and exercises `/v1/organizations/:orgId/projects`, `/v1/projects/:id`, and `/v1/projects/:id/api-keys`: creating a second project in an org with an existing key, confirming a key from one project is rejected (`403`) on another project in the same org, confirming a key from a different org is rejected (`403`) on `:orgId/projects`, confirming no key is rejected (`401`), and minting an additional key for a project. Same `afterEach` cleanup pattern as `organization.e2e-spec.ts`. | This is the actual proof of the project-isolation guarantee described in `src/common/auth/README.md` and `database/migrations/README.md` — a passing suite here means the composite-FK isolation at the DB level and the guard-level isolation at the HTTP level agree with each other. |
| `jest-e2e.json` | Jest config for e2e specs: `rootDir` one level up (repo root), matches `*.e2e-spec.ts`, transforms via `ts-jest`, and maps `./x.js` → `./x` (`moduleNameMapper`) so the generated Prisma client's `.js`-suffixed internal imports resolve against the `.ts` sources under `ts-jest`. Run via `npm run test:e2e`. | Kept separate from the unit-test Jest config in `package.json` since e2e specs need a different `rootDir`/test match pattern and take longer to run (real app bootstrap, real DB connections). The `moduleNameMapper` entry exists because Prisma 7's generated client is written as `nodenext`-style TS (importing its own siblings with explicit `.js` extensions), which `ts-jest` can't resolve without it — this only ever surfaced once a spec first pulled in `PrismaService` transitively. |

`npm run test:e2e` runs via `node --experimental-vm-modules node_modules/jest/bin/jest.js ...` (see `package.json`) rather than plain `jest` — Prisma 7's WASM query-compiler loader uses dynamic `import()`, which Jest's CommonJS transform can't execute without that Node flag.

## `integration/`

Currently empty — reserved for tests that need a real database/Redis connection (as opposed to `*.e2e-spec.ts` here, which boot the app but don't necessarily require live infra for every test). No README yet since it has no files; add one here (or its own) once it's populated.
