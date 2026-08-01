# T009 — Password recovery, change, and session management

**Status:** Implemented, pending Docker integration execution  
**Phase:** B — Users and authentication  
**Depends on:** T008  
**Estimated size:** 1 day

## Objective

Complete the account-security workflows for forgotten passwords, authenticated password changes, and device-session visibility/revocation.

## Scope

- Forgot/reset password endpoints.
- Change-password endpoint.
- List and revoke sessions endpoints.
- Security email hooks.

## Required implementation

1. Return the same forgot-password response for existing/non-existing emails.
2. Create short-lived, single-use, hashed reset tokens; invalidate older unused reset tokens.
3. Consume a reset token, change the Argon2id hash, and revoke all sessions atomically.
4. Require the current password for authenticated password change and revoke other sessions.
5. List sessions with safe device, creation, last-use, current-session, expiry, and revocation fields.
6. Prevent a user from revoking another user’s session.

## Acceptance criteria

- [ ] Reset tokens expire, are single-use, and are never logged.
- [ ] Successful reset revokes all sessions.
- [ ] Session list never exposes token hashes, raw IPs, or secrets.
- [ ] Revoked sessions cannot refresh or call protected endpoints.

## Required tests

- Integration tests for enumeration resistance, expiry, reuse, password change, session ownership, and revocation.

## Out of scope

- MFA and account administration UI.

## Implementation notes

- Added `/v1/auth/forgot-password`, `/v1/auth/reset-password`, `/v1/users/me/change-password`, `/v1/auth/sessions`, and `/v1/auth/sessions/:sessionId`.
- Forgot-password returns non-enumerating responses and stores only hashed, short-lived reset tokens.
- Reset consumes tokens under row lock, updates Argon2id password hash, and revokes all sessions atomically.
- Authenticated password change verifies the current password, updates the hash, and revokes other sessions.
- Session listing exposes safe device/session metadata only; no token hashes, raw IPs, or secrets.
- Session revocation is scoped to the current user.
- Added password reset email coverage and config validation.
- Full password-reset/session integration execution is pending Docker daemon availability.
