# T008 — Login, access JWT, and refresh-token rotation

**Status:** Implemented, pending Docker integration execution  
**Phase:** B — Users and authentication  
**Depends on:** T007  
**Estimated size:** 1–2 days

## Objective

Implement secure email/password login, short-lived access JWTs, rotating refresh sessions, logout, and replay detection.

## Scope

- `/v1/auth/login`, `/refresh`, `/logout`, and `/logout-all`.
- Global JWT guard and current-user/session decorator.
- Session and refresh-token repositories with pessimistic locking.

## Required implementation

1. Verify Argon2id hashes and rehash on login when parameters are outdated.
2. Create a session plus one active hashed refresh token after successful login.
3. Sign asymmetric access JWTs containing `sub`, `sid`, issuer, audience, and expiry only.
4. Deliver refresh token in a Secure/HttpOnly/SameSite cookie.
5. Rotate refresh tokens atomically; mark the prior token `ROTATED` and link its replacement.
6. If any rotated/revoked token is replayed, revoke the entire session family.
7. Enforce user status and session revocation on protected requests.

## Acceptance criteria

- [ ] Invalid login uses a generic response and timing-resistant flow.
- [ ] Exactly one of two concurrent refresh attempts succeeds.
- [ ] Replaying the old token revokes the session.
- [ ] Logout revokes current session; logout-all revokes every user session.
- [ ] Access JWT validation rejects wrong signature/issuer/audience/expiry/session.

## Required tests

- Unit tests for token generation/verification.
- Integration tests for login, rotation, concurrency, replay, logout, suspension, and cookie attributes.

## Out of scope

- Password recovery and frontend screens.

## Implementation notes

- Added `/v1/auth/login`, `/v1/auth/refresh`, `/v1/auth/logout`, and `/v1/auth/logout-all`.
- Added RS256 asymmetric access JWT signing/verification with issuer, audience, subject, session ID, and expiry validation.
- Added Secure/HttpOnly/SameSite refresh cookie helpers.
- Login verifies Argon2id hashes, enforces user status, creates a session, and stores only a hashed refresh token.
- Refresh rotates tokens atomically under row lock and revokes the session on rotated/revoked token replay.
- `CurrentUserGuard` now validates Bearer access JWTs and live session state; a non-production `x-user-id` fallback remains for development until full UI auth wiring.
- Added unit tests for asymmetric JWT signing/verification and refresh-cookie attributes.
- Full login/refresh/concurrency/replay integration execution is pending Docker daemon availability.
