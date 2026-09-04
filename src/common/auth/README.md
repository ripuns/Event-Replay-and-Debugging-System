# src/common/auth

Authentication and access-control guards. **API-key auth is the active mechanism** for this phase (see `CONTEXT_SUMMARY.md` §5, "Decisions confirmed" in the org/project implementation plan); JWT files exist as scaffolding for a possible future human-login flow but are not wired into any route.

## Files

| File | Purpose | Why |
|---|---|---|
| `api-key.guard.ts` (`ApiKeyGuard`) | Extracts the `Authorization: Bearer <rawKey>` header, calls `ApiKeyService.verify()`, and on success attaches `{ projectId, organizationId, apiKeyId }` to `request.auth`. Throws `401` if the header is missing/malformed or the key is invalid/revoked/expired. | The single entry point that turns a raw request into an authenticated one. Every guarded route applies this first; downstream guards (`ProjectAccessGuard`, `OrganizationAccessGuard`) assume `request.auth` is already populated and only check scope, not validity. |
| `project-access.guard.ts` (`ProjectAccessGuard`) | Compares `request.params.id` (the route's project id) against `request.auth.projectId`. Throws `403` on mismatch. | Enforces that an API key (already project-scoped by design) can only touch the one project it was issued for — no DB round-trip needed since the key lookup already resolved `projectId`. Must run after `ApiKeyGuard`. |
| `organization-access.guard.ts` (`OrganizationAccessGuard`) | Compares `request.params.orgId` against `request.auth.organizationId`. Throws `403` on mismatch. | Used on `POST /v1/organizations/:orgId/projects` — lets any key belonging to *some* project in an org create additional projects in that same org, while still rejecting a key from a different org. Must run after `ApiKeyGuard`. |
| `request-context.ts` | Type definitions: `AuthenticatedUser`/`ProjectContext` (JWT-era, currently unused), `ApiKeyAuthContext` (`{ projectId, organizationId, apiKeyId }`, the active shape), and `RequestContext extends Request` carrying `user`, `projectContext`, and optional `auth`. | Gives every guard/controller a typed view of what's on the Express request instead of `any`. `auth` is optional because it's only populated once `ApiKeyGuard` has run. |
| `auth.module.ts` | Registers `PassportModule` + `JwtModule` (secret from `JWT_SECRET`) and provides `JwtStrategy`. | Dead-but-harmless scaffolding — kept per the project rule "don't rewrite scaffolding without clear reason" in case JWT/human login is picked up later. Not imported by any guarded route today. |
| `jwt.strategy.ts` (`JwtStrategy`) | Passport strategy validating a bearer JWT against `JWT_SECRET`, expecting a `{ sub, organizationId, role }` payload. | Same as above — scaffolded, unused. There is no login/register endpoint anywhere in the app that issues a token this strategy could validate. |
| `jwt-auth.guard.ts` (`JwtAuthGuard`) | Thin `AuthGuard('jwt')` wrapper. | Companion to `jwt.strategy.ts` — also unused by any route currently. |

## Guard ordering

Routes needing project scope use `@UseGuards(ApiKeyGuard, ProjectAccessGuard)`; routes needing org scope use `@UseGuards(ApiKeyGuard, OrganizationAccessGuard)`. `ApiKeyGuard` must always run first — the other two guards read `request.auth`, which only `ApiKeyGuard` populates.
