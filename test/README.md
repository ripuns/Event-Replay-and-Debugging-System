# test

End-to-end (e2e) tests — boot the full Nest app (`AppModule`) and hit real HTTP routes via `supertest`, as opposed to the isolated unit specs colocated with their modules (e.g. `src/modules/health/health.controller.spec.ts`).

## Files

| File | Purpose | Why |
|---|---|---|
| `health.e2e-spec.ts` | Boots the app with the global `/v1` prefix and asserts `GET /v1/health` returns `{ status: 'ok', service: 'replaydb-api', timestamp }`. | Confirms the app actually starts end-to-end (config validation, module wiring, DI graph) — not just that individual units work in isolation. |
| `jest-e2e.json` | Jest config for e2e specs: `rootDir` one level up (repo root), matches `*.e2e-spec.ts`, transforms via `ts-jest`. Run via `npm run test:e2e`. | Kept separate from the unit-test Jest config in `package.json` since e2e specs need a different `rootDir`/test match pattern and take longer to run (real app bootstrap, potentially real DB connections). |

## `integration/`

Currently empty — reserved for tests that need a real database/Redis connection (as opposed to `*.e2e-spec.ts` here, which boot the app but don't necessarily require live infra for every test). No README yet since it has no files; add one here (or its own) once it's populated.
