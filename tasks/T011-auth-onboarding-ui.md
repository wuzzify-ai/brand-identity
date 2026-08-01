# T011 — Authentication and onboarding UI

**Status:** Implemented, pending end-to-end execution  
**Phase:** B — Users and authentication  
**Depends on:** T004, T007, T008, T009, T010  
**Estimated size:** 1–2 days

## Objective

Build accessible user-facing registration, verification, login, password recovery, invitation, workspace selection, and session/account pages.

## Scope

- Public auth routes listed in section 9.
- Authenticated onboarding/account/workspace settings routes.
- Secure session bootstrap/refresh behavior.

## Required implementation

1. Build Zod-backed forms with field/server errors and pending states.
2. Keep access tokens out of persistent browser storage; use the selected secure session/BFF pattern.
3. Handle verification/reset/invitation token success, expiry, and reuse cleanly.
4. Add workspace creation/selection and member/invitation management according to role.
5. Add device-session list/revoke and logout-all controls.
6. Redirect safely using validated internal return paths only.
7. Support keyboard navigation, screen readers, RTL, and responsive layouts.

## Acceptance criteria

- [ ] Complete registration-to-workspace flow works without manual API calls.
- [ ] Expired/invalid tokens show recovery actions without leaking account existence.
- [ ] A revoked session returns the user to login without losing unsaved public form input.
- [ ] Role-restricted controls are hidden and also rejected by the API.

## Required tests

- Component tests for forms and error states.
- E2E tests for registration, verification, login, refresh, reset, invitation, workspace switch, and logout.

## Out of scope

- Brand identity workspace UI (T014).

## Implementation notes

- Added public registration, login, verification, forgot-password, reset-password, and invitation acceptance routes.
- Added authenticated account/session management and workspace management pages.
- Added in-memory access-token auth provider; refresh token remains cookie-backed and access tokens are not persisted to browser storage.
- Added typed auth/workspace API clients, safe return path validation, Zod-backed form parsing, field/server error states, pending states, and responsive layouts.
- Added session revoke/logout controls and owner invitation UI.
- Added basic auth API schema tests.
- Full browser E2E execution is pending a running API/database environment.
