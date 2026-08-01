# T005 — Authentication and workspace database migration

**Status:** Implemented, pending Docker integration execution  
**Phase:** B — Users and authentication  
**Depends on:** T003  
**Estimated size:** 1–2 days

## Objective

Implement the first TypeORM migration/entities for all user, credential, session, token, workspace, membership, and invitation tables in section 13.

## Scope

- `users`, `user_credentials`, `auth_identities`, `auth_sessions`, `auth_refresh_tokens`.
- `email_verification_tokens`, `password_reset_tokens`.
- `workspaces`, `workspace_memberships`, `workspace_invitations`.
- PostgreSQL `citext`, enums, constraints, and indexes.

## Required implementation

1. Translate the plan DDL exactly into an ordered TypeORM migration.
2. Model relations without eager-loading secrets.
3. Mark password/token hash fields `select: false` or isolate them in dedicated repositories.
4. Add timestamp/optimistic-lock conventions.
5. Add repositories that expose narrowly scoped authentication queries.
6. Create test factories that generate hashes/tokens without static shared secrets.

## Acceptance criteria

- [ ] Migration applies to an empty database and reverts cleanly.
- [ ] Case-insensitive duplicate emails are rejected.
- [ ] Only one active refresh token can exist per session.
- [ ] Duplicate memberships and pending invitations are rejected by constraints.
- [ ] Generic user serialization never includes password/token hashes.

## Required tests

- Testcontainers integration tests for every unique/check/partial-index rule.
- Migration up/down smoke test.

## Out of scope

- Registration/login service behavior.

## Implementation notes

- Added TypeORM entities/enums for users, credentials, identities, sessions, refresh tokens, verification/reset tokens, workspaces, memberships, and invitations.
- Added ordered migration `1795120000000-CreateAuthWorkspaceSchema` matching the plan DDL for PostgreSQL extensions, enums, tables, constraints, and partial indexes.
- Added `AuthDatabaseModule`, narrow auth/workspace query repositories, and random test factories for hashes/tokens.
- Secret fields such as password hashes, refresh token hashes, invitation token hashes, and IP hashes are `select: false` and omitted from entity `toJSON()` where applicable.
- Added Testcontainers integration spec for duplicate case-insensitive email, one active refresh token per session, duplicate memberships, pending invitation uniqueness, invitation owner-role checks, secret serialization, and migration down smoke.
- Local integration execution is pending because Docker Desktop's daemon is not running. Run it later with:

  ```bash
  pnpm --filter @wuzzify/brand-identity-api test:integration
  ```
