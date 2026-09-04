# src/projects

Project domain module — the primary operational and permission boundary. A project belongs to one organization and owns API keys, aggregates, events, snapshots, and replay jobs (see `CONTEXT_SUMMARY.md` §7).

## Files

| File | Purpose | Why |
|---|---|---|
| `projects.controller.ts` (`ProjectsController`) | Three routes, all guarded: `POST /v1/organizations/:orgId/projects` (`ApiKeyGuard` + `OrganizationAccessGuard`) creates an additional project in an org the caller's key belongs to, minting its first key. `POST /v1/projects/:id/api-keys` (`ApiKeyGuard` + `ProjectAccessGuard`) mints an extra key for a project the caller already holds a key for. `GET /v1/projects/:id` (`ApiKeyGuard` + `ProjectAccessGuard`) fetches a project. | Every write/read is scoped by a guard before the handler runs — the controller itself does no auth logic, only delegates to `ProjectsService`/`ApiKeyService` and DTO validation. |
| `projects.module.ts` (`ProjectsModule`) | Imports `PrismaModule`, `ApiKeyModule`; provides `ProjectsService`/`ProjectsRepository`/`ApiKeyGuard`/`ProjectAccessGuard`/`OrganizationAccessGuard`; registers `ProjectsController`; exports `ProjectsService` **and** `ProjectsRepository`. | Exports `ProjectsRepository` (not just the service) specifically so `OrganizationModule` can import this module and reuse it during the org-bootstrap transaction, instead of duplicating a second `ProjectsRepository` provider. |
| `projects.service.ts` (`ProjectsService`) | `create(organizationId, name)` — plain create. `createWithFirstKey(organizationId, name)` — wraps project creation + first API key minting in `prisma.$transaction(...)`, used by both the org-bootstrap flow and the `:orgId/projects` route. `requireProject(projectId, organizationId)` — throws `403` if the project isn't in that org (legacy JWT-era helper, no longer called by any guard but kept for potential reuse). `findById(projectId)`. | Same all-or-nothing transactional guarantee as `OrganizationService.create` — a project should never exist without at least one usable key, or vice versa. |
| `projects.repository.ts` (`ProjectsRepository`) | Thin Prisma wrapper: `create(organizationId, name, client?)`, `findForOrganization(projectId, organizationId)`, `findById(projectId)`. Accepts an optional Prisma client/transaction param on `create`. | Keeps direct Prisma query syntax out of the service layer; the optional transaction param lets project creation participate in a parent transaction (org bootstrap, or `createWithFirstKey`). |
| `dto/create-project.dto.ts` (`CreateProjectDto`) | `class-validator` DTO: `name` (required string, max 255). | Validated by the global `ValidationPipe` before reaching the controller/service. |

## Note on `ProjectAccessGuard`'s route param

`ProjectAccessGuard` (in `common/auth`) reads `request.params.id`, so any route it guards must name its project-id param `:id`, not `:projectId` — matches `GET /v1/projects/:id` and `POST /v1/projects/:id/api-keys` above.
