# src/modules/health

Liveness/status endpoint — the first module scaffolded in the project (Phase 0), used to verify the app boots and responds before any real domain logic existed.

## Files

| File | Purpose | Why |
|---|---|---|
| `health.controller.ts` (`HealthController`) | `GET /v1/health` → delegates to `HealthService.getHealth()`. | Thin controller, no logic of its own — matches the project rule "keep controllers thin." |
| `health.service.ts` (`HealthService`) | Returns `{ status: 'ok', service: 'replaydb-api', timestamp }`. | Simple static/synchronous check for now — no DB/Redis connectivity check yet. Would be the place to add readiness checks (DB ping, Redis ping) in Phase 8 (observability/hardening). |
| `health.module.ts` (`HealthModule`) | Registers `HealthController`/`HealthService`. | Standard Nest module; imported unconditionally in `app.module.ts` since health should always be reachable regardless of other modules' state. |
| `health.controller.spec.ts` | Unit test for `HealthController`. | Confirms the controller returns whatever the service produces, isolated from HTTP/Nest bootstrap (see `test/health.e2e-spec.ts` for the full-stack version). |
