# T007 — Registration and email verification

**Status:** Implemented, pending Docker integration execution  
**Phase:** B — Users and authentication  
**Depends on:** T005, T006  
**Estimated size:** 1–2 days

## Objective

Allow a new user to register safely, receive a verification link, verify once, and enter onboarding.

## Scope

- `/v1/auth/register`, `/v1/auth/verify-email`, and resend-verification behavior.
- Argon2id password hashing and password policy.
- Transactional email abstraction/templates.
- Atomic creation of user, credential, initial workspace, owner membership, and verification token.

## Required implementation

1. Normalize email through `citext`; do not lowercase passwords or display names.
2. Enforce length/compromised-password policy without brittle composition rules.
3. Generate a cryptographically random verification token; store only a peppered hash.
4. Send a URL containing the raw token after the transaction commits.
5. Consume verification tokens once using a row lock; activate the user and timestamp verification.
6. Rate-limit registration/resend per IP and email and use non-enumerating responses where needed.

## Acceptance criteria

- [ ] Registration creates every required row atomically.
- [ ] Duplicate email races produce a safe conflict response.
- [ ] Verification tokens expire and cannot be reused.
- [ ] Email failures can be retried without duplicate users/workspaces.
- [ ] Passwords and raw tokens never appear in logs or database rows.

## Required tests

- Integration tests for success, duplicate email, weak password, expired/reused token, resend, rollback, and email-provider failure.

## Out of scope

- Login and OAuth.

## Implementation notes

- Added `/v1/auth/register`, `/v1/auth/verify-email`, and `/v1/auth/resend-verification`.
- Added Argon2id password hashing, password policy checks, HMAC-SHA256 token hashing with `TOKEN_HASH_PEPPER`, and random raw token generation.
- Registration transaction creates user, credential, initial workspace, owner membership, and verification token atomically.
- Verification consumes a single token under row lock and activates the user.
- Resend uses non-enumerating responses and invalidates older unused verification tokens.
- Added transactional email abstraction and in-memory local delivery adapter.
- Added unit tests for password policy, token hashing, email-link construction, and config.
- Full registration/verification database integration execution is pending Docker daemon availability.
