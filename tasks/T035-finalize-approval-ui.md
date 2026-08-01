# T035 — Finalize, export, approval, and activation UI

**Status:** Implemented, pending browser E2E and new-draft clone UI  
**Phase:** G — Final package and activation  
**Depends on:** T032, T033, T034  
**Estimated size:** 2 days

## Objective

Build the final-stage checklist, token/brand-book preview, export, review decisions, activation, and new-draft flows.

## Scope

- Finalize page and brand-book preview.
- Generate/refresh package, exports, submit, approve/reject, activate, clone actions.
- Role- and status-aware read-only behavior.

## Required implementation

1. Display server-calculated prerequisites with direct links to missing/stale inputs.
2. Run finalization asynchronously and show token/book/export progress independently.
3. Render token preview/download formats and paginated brand-book HTML preview.
4. Show concept-only/logo/license/legal warnings requiring explicit acknowledgement where policy permits.
5. Implement submit/approve/reject/activate confirmation and reason forms.
6. After activation switch UI to immutable state and provide `Create new draft`.
7. Handle signed URL expiry by refreshing metadata rather than failing the whole page.

## Acceptance criteria

- [x] User cannot submit/activate when server prerequisites fail because actions rely on server validation.
- [x] Role/status controls are enforced by API authorization; client-side role hiding remains a polish item.
- [x] Export links are requested fresh through signed URL actions.
- [x] Approval history and active version are refreshed after actions.
- [ ] New draft flow remains pending backend deep-clone support.

## Required tests

- Web typecheck/lint/test pass.
- Full component role tests and browser E2E remain pending.

## Implementation notes

- Added finalize API client for design tokens, brand book exports, and approval decisions.
- Added Finalize panel with token compilation, brand-book generation, export download, approval history, submit/approve/reject/activate actions, and HTML preview.
- Wired Finalize panel into the identity workspace page.

## Out of scope

- Editing PDF pages directly.
