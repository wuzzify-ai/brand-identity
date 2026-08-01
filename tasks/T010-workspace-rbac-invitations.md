# T010 — Workspace RBAC and invitations

**Status:** Implemented, pending Docker integration execution  
**Phase:** B — Users and authentication  
**Depends on:** T005, T008, T009  
**Estimated size:** 1–2 days

## Objective

Implement workspace CRUD, live membership authorization, role management, and secure invitations.

## Scope

- Workspace, membership, and invitation endpoints from section 10.
- `WorkspaceMembershipGuard` and role decorators.
- Last-owner and cross-workspace protections.

## Required implementation

1. Resolve workspace from a documented route/header and load active membership on every protected request.
2. Implement role capability mapping from section 4.
3. Create/list/update/archive workspaces with optimistic locking.
4. Invite an email using a single-use hashed token and transactional email.
5. Accept invitations only when signed-in email matches; create/update membership atomically.
6. Implement role change/removal with a locked last-owner check.
7. Revoke/expire invitations and prevent duplicate pending invitations.

## Acceptance criteria

- [ ] Removed/suspended membership loses access immediately.
- [ ] No user can read or mutate another workspace by guessing IDs.
- [ ] A workspace always has at least one active owner.
- [ ] Invitation token is expiring, single-use, and email-bound.
- [ ] Viewer/editor/reviewer/owner permissions match the plan.

## Required tests

- Table-driven authorization tests for every role/action.
- Integration tests for invitation races, last-owner rules, and tenant isolation.

## Out of scope

- Billing and enterprise SSO.

## Implementation notes

- Added `WorkspacesModule`, workspace controller/service, RBAC role decorator, and live membership guard.
- Added workspace create/list/read/update/archive endpoints.
- Added member listing, role update, removal, and last-owner safeguards.
- Added pending invitation create/list/revoke and signed-in email-bound invitation acceptance.
- Invitation tokens are single-use, expiring, and stored only as HMAC hashes.
- Added workspace invitation email template.
- Added table-driven role capability tests.
- Full invitation race, last-owner, and tenant isolation integration execution is pending Docker daemon availability.
