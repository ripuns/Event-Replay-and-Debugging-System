# src/prisma

Nest-DI wrapper around the generated Prisma client. Every other module gets database access exclusively through `PrismaService`, never by instantiating `PrismaClient` directly.

## Files

| File | Purpose | Why |
|---|---|---|
| `prisma.service.ts` (`PrismaService`) | Extends the generated `PrismaClient`, constructed with a `PrismaPg` driver adapter (`@prisma/adapter-pg`) built from `DATABASE_URL`. Implements `OnModuleInit`/`OnModuleDestroy` to `$connect()`/`$disconnect()` in step with the Nest app lifecycle. | Prisma 7 requires an explicit driver adapter rather than a bare connection string — instantiating `PrismaClient` with no options throws `PrismaClientInitializationError` at runtime. Wrapping it as an injectable service (rather than a global singleton import) lets Nest manage its lifecycle and lets tests substitute a mock. |
| `prisma.module.ts` (`PrismaModule`) | `@Global()` module providing and exporting `PrismaService`. | Marked global so every feature module gets `PrismaService` without each one re-importing `PrismaModule` explicitly — avoids accidentally creating a second `PrismaClient`/connection pool from a module that provided `PrismaService` itself instead of importing this module. |

## Usage pattern

Repositories (`OrganizationRepository`, `ProjectsRepository`, `ApiKeyRepository`) take `PrismaService` in their constructor and either query it directly or accept an optional `Prisma.TransactionClient` parameter (defaulting to `this.prisma`) so the same method can run standalone or inside a `prisma.$transaction(...)` block — used for the atomic "create org/project + first API key" flows in `organization.service.ts`/`projects.service.ts`.
