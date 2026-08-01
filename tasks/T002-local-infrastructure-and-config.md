# T002 — Local infrastructure and typed configuration

**Status:** Implemented, pending dependency smoke  
**Phase:** A — Foundation  
**Depends on:** T001  
**Estimated size:** 1 day

## Objective

Provide reproducible local PostgreSQL, Redis, and S3-compatible object storage plus fail-fast typed configuration for each app.

## Scope

- Docker Compose services for PostgreSQL, Redis, and MinIO or the repository-approved equivalents.
- `.env.example` containing names but no real secrets.
- NestJS configuration validation and separate web-safe environment validation.
- Health/readiness wiring for dependency checks.

## Required implementation

1. Add version-pinned local service definitions, named volumes, and health checks.
2. Implement config schemas covering database, Redis, OpenRouter placeholders, object storage, JWT, email, CDN, and app URLs from section 22 of the plan.
3. Ensure startup fails with a useful message when required configuration is missing or malformed.
4. Separate private server variables from `NEXT_PUBLIC_*` variables.
5. Document startup, shutdown, reset, and local object-storage bucket creation.

## Acceptance criteria

- [ ] A fresh developer can start dependencies with one documented command.
- [ ] API and worker wait for or clearly report unavailable dependencies.
- [ ] Invalid URLs, durations, byte limits, or missing secrets fail at startup.
- [ ] The web bundle contains no server-only variables.

## Required tests

- Configuration unit tests for valid, missing, and malformed environments.
- Local smoke test for PostgreSQL, Redis, and object-storage connectivity.

## Out of scope

- Production infrastructure and deployment automation (T040).

## Implementation notes

- Added Docker Compose for PostgreSQL, Redis, and MinIO with named volumes and health checks.
- Added `.env.example` and fail-fast Zod config validation for API, worker, and web-safe public variables.
- Config unit tests cover valid, missing, and malformed API environments.
- Full PostgreSQL/Redis/MinIO connectivity smoke is still pending.
