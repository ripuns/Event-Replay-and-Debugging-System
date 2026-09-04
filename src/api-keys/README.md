# src/api-keys

Project-scoped API key generation and verification — the active auth credential type for the whole API (see `common/auth/README.md`).

## Files

| File | Purpose | Why |
|---|---|---|
| `api-keys.module.ts` (`ApiKeyModule`) | Imports `PrismaModule`; provides `ApiKeyService`/`ApiKeyRepository`; exports `ApiKeyService`. | Standard Nest module wiring, following the same shape as `organization.module.ts`/`projects.module.ts`. Imported by `OrganizationModule` and `ProjectsModule` since both need to mint keys. |
| `api-keys.service.ts` (`ApiKeyService`) | `create(projectId, name, client?)`: generates a random 32-byte secret (`crypto.randomBytes`, base64url), prefixes it (`rk_...`), SHA-256 hashes it for storage, persists the hash+prefix via the repository, and returns `{ id, prefix, rawKey }` — the **only** place the raw key ever exists outside the client's own copy. `verify(rawKey)`: hashes the input, looks it up, rejects if missing/revoked/expired, else returns `{ apiKeyId, projectId, organizationId }`. | Centralizes key generation/hashing logic so no caller ever handles raw secrets except at creation time — matches the project rule "do not store raw API keys." SHA-256 (not bcrypt) is used because the input is already a high-entropy random token, not a low-entropy human password — no slow KDF needed. |
| `api-keys.repository.ts` (`ApiKeyRepository`) | Thin Prisma wrapper: `create(...)` and `findByHash(keyHash)` (the latter includes `project.organizationId` so the guard can build a full auth context in one query). Every method accepts an optional Prisma client/transaction param, defaulting to the injected `PrismaService`. | Keeps `ApiKeyService` free of direct Prisma query syntax, and the optional transaction param lets key creation participate in the same atomic transaction as org/project creation during bootstrap. |
| `dto/create-api-key.dto.ts` (`CreateApiKeyDto`) | `class-validator` DTO: `name` (required string, max 255). | Used by `ProjectsController`'s `POST /v1/projects/:id/api-keys` route so key names go through the same global `ValidationPipe` as every other input, instead of an untyped inline body. |

## Security notes

- Raw keys are never persisted — only `key_hash` (SHA-256) and `key_prefix` (first 12 chars, for display/identification) are stored.
- Keys are project-scoped (`api_keys.project_id`), not org-scoped — a key only ever grants access to the one project it was minted for. See `database/migrations/README.md` (V003) and `common/auth/README.md`.
