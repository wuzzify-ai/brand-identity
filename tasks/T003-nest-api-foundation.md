# T003 — NestJS API foundation

**Status:** Implemented, pending dependency smoke  
**Phase:** A — Foundation  
**Depends on:** T001, T002  
**Estimated size:** 1 day

## Objective

Create the common API foundation used by all later modules.

## Scope

- Global validation, exception mapping, request IDs, structured logging, OpenAPI, versioned routing, CORS, and graceful shutdown.
- TypeORM connection and migration commands.
- Liveness and readiness endpoints.

## Required implementation

1. Configure a global `ValidationPipe` with whitelist/forbid behavior and transforms.
2. Add stable domain error codes and an exception filter returning a consistent error envelope.
3. Propagate or create `requestId` and include it in logs/responses.
4. Configure API prefix `/v1`, OpenAPI generation, and DTO conventions.
5. Configure TypeORM with migrations; keep `synchronize` disabled.
6. Add health checks for process, database, and Redis readiness.
7. Add graceful shutdown for HTTP and database connections.

## Acceptance criteria

- [ ] Invalid input returns a documented 400 error envelope.
- [ ] Unexpected errors do not expose stack traces in production.
- [ ] OpenAPI JSON is generated deterministically.
- [ ] Migration generate/run/revert scripts work.
- [ ] Liveness does not fail merely because a dependency is down; readiness does.

## Required tests

- API integration tests for validation, 404, domain error, request ID, liveness, and readiness.

## Out of scope

- Feature-specific controllers and authorization.

## Implementation notes

- Added NestJS API bootstrap with `/v1` routing, validation, request IDs, error envelopes, CORS, OpenAPI, TypeORM, and health endpoints.
- Added tests for config validation and exception envelope mapping.
- Production API build passes; dependency-backed readiness smoke is still pending.
