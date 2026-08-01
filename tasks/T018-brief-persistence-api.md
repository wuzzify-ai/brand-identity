# T018 — Brief persistence and API

**Status:** Implemented, pending Docker integration execution  
**Phase:** E — Brief and strategy  
**Depends on:** T012, T013  
**Estimated size:** 1–2 days

## Objective

Implement the complete editable Brief aggregate, validation, completion calculation, and API.

## Scope

- Brief tables/entities from section 13: root, languages, audiences, markets, offerings, preferences, constraints.
- Read/update/complete endpoints and optimistic locking.
- Stage completion and downstream stale propagation service foundation.

## Required implementation

1. Add reversible migration with the documented indexes/checks and one-primary-language constraint.
2. Create aggregate DTOs supporting safe add/update/delete/reorder of child rows by stable UUID.
3. Implement transactionally scoped replace/patch semantics without deleting omitted data accidentally.
4. Calculate required-field completion exactly as section 6.1 specifies.
5. Complete Brief only when valid; record confirmer/time and unlock Strategy.
6. On edits after completion, mark dependent completed/generated stages `STALE` without deleting them.
7. Preserve `origin` and set user-edited records/fields appropriately.

## Acceptance criteria

- [x] Every requested brief field can be entered and edited manually.
- [x] Exactly one primary language is enforced.
- [x] Completion fails with field-level reasons when required data is missing.
- [x] Confirming unlocks Strategy; later edits make downstream content stale.
- [x] Foreign workspace/version access is impossible.

## Required tests

- Migration constraints, aggregate updates, list ordering, conflict, completion, stale propagation, and role authorization.

## Implementation notes

- Added `brand_briefs` root table and ordered child tables for languages, audiences, markets, offerings, preferences, and constraints.
- Added one-primary-language partial unique index and required completion constraints.
- Added editable aggregate DTOs using stable child UUIDs and section-level replace semantics: omitted child arrays are preserved, supplied child arrays replace that section.
- Added `BriefsModule` with:
  - `GET /workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/brief`
  - `PUT /workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/brief`
  - `POST /workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/brief/complete`
- Completion requires industry, positioning, languages, exactly one primary language, audiences, markets, products/services, preferences, and constraints.
- Completing Brief marks the Brief stage completed and unlocks Strategy.
- Editing after confirmation recalculates completion and marks generated/completed downstream stages stale without deleting content.

## Verification

- `pnpm --filter @wuzzify/brand-identity-api typecheck`
- `pnpm --filter @wuzzify/brand-identity-api lint`
- `pnpm --filter @wuzzify/brand-identity-api test -- openrouter-chat-transport.spec.ts ai-policy-support.spec.ts generation-support.spec.ts brief-completion.spec.ts`

## Known limitation

- Database-backed migration/API integration execution is pending because Docker Desktop is not running in this environment.

## Out of scope

- AI extraction and Brief UI.
