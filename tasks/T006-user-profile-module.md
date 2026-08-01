# T006 — User profile module

**Status:** Implemented  
**Phase:** B — Users and authentication  
**Depends on:** T005  
**Estimated size:** 1 day

## Objective

Implement safe user profile reads/updates and account-status domain behavior.

## Scope

- `UsersModule`, repository/service, DTOs, and `/v1/users/me` endpoints.
- Display name, avatar URL, locale, timezone, and soft deletion.
- Internal lookup methods for authentication modules.

## Required implementation

1. Create public/internal user projections that never expose secret relations.
2. Validate locale, timezone, name length, and avatar URL.
3. Implement optimistic profile updates.
4. Implement soft deletion: mark status/deleted time, revoke sessions via an event/service hook, and define email retention/anonymization behavior.
5. Add admin-only suspend/reactivate service operations if the project has an admin surface; otherwise expose internal commands only.

## Acceptance criteria

- [ ] A user can read and update only their own profile.
- [ ] Invalid locale/timezone/URL input is rejected.
- [ ] Concurrent stale updates return 409.
- [ ] Deleted/suspended users cannot authenticate.
- [ ] Responses contain no credential/session token data.

## Required tests

- Unit tests for status transitions and validation.
- API integration tests for read, update, conflict, suspension, and deletion.

## Out of scope

- Login, password change, and workspace membership.

## Implementation notes

- Added `UsersModule`, `UsersController`, `UsersService`, and `UsersRepository`.
- Added `/v1/users/me` read/update/delete endpoints behind `CurrentUserGuard`.
- Added public profile projection that never exposes credential, session, token, or hash fields.
- Added locale, timezone, URL, name, and optimistic-lock validation.
- Added soft deletion with email anonymization and session revocation hook.
- Added internal suspend/reactivate/authentication-status operations for later auth modules.
- Added focused unit tests for projection, validation, stale update conflict, soft deletion session revocation, and blocked authentication statuses.
