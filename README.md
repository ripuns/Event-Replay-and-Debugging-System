# ReplayDB

ReplayDB is an event replay and time-travel debugging platform designed to help engineering teams capture, store, and replay immutable business events. It enables applications to reconstruct historical state, investigate production incidents, audit system behavior, and validate application logic without relying solely on mutable database records.

The platform is designed around event-driven architecture principles, where every state transition is represented as an immutable event. By replaying these events in sequence, ReplayDB can rebuild the exact state of an aggregate at any point in time.

---

# Architecture

ReplayDB follows a modular, service-oriented architecture.

```
                    Client Applications
                            │
                            ▼
                    NestJS REST API
                            │
          ┌─────────────────┴─────────────────┐
          │                                   │
          ▼                                   ▼
     PostgreSQL                         Redis Cache
  (Immutable Event Store)          (Replay Optimization)
          │
          ▼
     Replay Engine
          │
          ▼
 Reconstructed Application State
```

Core domain hierarchy:

```
Organization
    └── Project
            ├── API Keys
            ├── Aggregates
            │       ├── Events
            │       └── Snapshots
            └── Replay Jobs
```

---

# Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 22 LTS |
| Framework | NestJS |
| Language | TypeScript |
| Database | PostgreSQL 16+ |
| ORM | Prisma |
| Database Migrations | Flyway |
| Cache | Redis |
| Authentication | JWT, API Keys |
| API Documentation | Swagger (OpenAPI) |
| Validation | class-validator, class-transformer |
| Logging | Winston |
| Testing | Jest |
| Containerization | Docker, Docker Compose |

---

# Prerequisites

The following software must be installed before running the application locally:

- Node.js 22 LTS
- npm
- PostgreSQL 16 or later
- Redis
- Docker Desktop (recommended)
- Git

Recommended development tools:

- Visual Studio Code
- pgAdmin 4
- Postman / Bruno

---

# Local Development

## Clone the repository

```bash
git clone <repository-url>
cd replaydb
```

---

## Install dependencies

```bash
npm install
```

---

## Configure environment variables

Create a local environment configuration.

```bash
cp .env.example .env
```

Update the required configuration values:

- PostgreSQL connection
- Redis connection
- JWT secret
- Application configuration

---

## Start infrastructure services

Using Docker Compose:

```bash
docker compose up -d
```

Verify that PostgreSQL and Redis are running before starting the application:

```bash
docker compose ps
```

If the services are already running, stop them with:

```bash
docker compose down
```

Reset local database and cache volumes:

```bash
docker compose down -v
```

If Docker is unavailable, ensure Docker Desktop or your Docker daemon is running before retrying.

---

## Apply database migrations

```bash
flyway migrate
```

---

## Generate Prisma Client

```bash
npx prisma generate
```

---

## Start the application

Development mode:

```bash
npm run start:dev
```

Production mode:

```bash
npm run build
npm run start:prod
```

The application will be available at:

```
http://localhost:3000
```

Swagger documentation:

```
http://localhost:3000/api
```

---

# Available Commands

| Command | Description |
|----------|-------------|
| `npm run start` | Start the application |
| `npm run start:dev` | Start in development mode |
| `npm run build` | Build the application |
| `npm run start:prod` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format source code |
| `npm run test` | Execute unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:cov` | Generate test coverage report |

---

# Database Commands

Apply pending migrations:

```bash
flyway migrate
```

Validate migration history:

```bash
flyway validate
```

View migration status:

```bash
flyway info
```

Generate Prisma Client:

```bash
npx prisma generate
```

---

# Project Status

ReplayDB is currently under active development.

The current milestone focuses on establishing the core platform infrastructure, including the immutable event store, replay engine, database schema, authentication, and foundational APIs. Subsequent iterations will introduce advanced replay capabilities, snapshot optimization, observability, and distributed deployment support.