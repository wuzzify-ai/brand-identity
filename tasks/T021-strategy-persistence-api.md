# T021 — Strategy persistence and API

**Status:** Implemented, pending Docker integration execution  
**Phase:** E — Brief and strategy  
**Depends on:** T018  
**Estimated size:** 1–2 days

## Objective

Implement the complete editable Strategy aggregate, required validation, completion, and stale propagation.

## Scope

- Strategy root, values, personas, messaging pillars, taglines, and brand rules tables/entities.
- Read/update/complete endpoints and optimistic locking.
- Selected tagline and list ordering constraints.

## Required implementation

1. Add reversible migration matching section 13.
2. Implement aggregate DTOs for positioning components, value proposition, mission, vision, essence, and promise.
3. Add stable-UUID CRUD/reorder for child collections.
4. Enforce one selected tagline per language and legal-review flag defaults.
5. Calculate completion using section 6.2 counts/content.
6. Completing Strategy unlocks Visuals; later Strategy/Brief edits mark Visuals and downstream stages stale.
7. Prevent Strategy generation/completion when Brief prerequisites are not complete/current.

## Acceptance criteria

- [x] Every planned Strategy field is manually editable.
- [x] Required counts and nonblank rules are server-enforced.
- [x] Selection/list updates are atomic and optimistic-lock safe.
- [x] Completion/stale transitions match the workflow state machine.

## Required tests

- Migration, aggregate CRUD, selected tagline, completion counts, stale propagation, conflicts, and permissions.

## Implementation notes

- Added `brand_strategies` root table and ordered child tables for values, personas, messaging pillars, taglines, and brand rules.
- Enforced one selected tagline per language with a partial unique index.
- Added editable aggregate DTOs for positioning, value proposition, mission, vision, essence, promise, values, personas, pillars, taglines, and rules.
- Added Strategy API:
  - `GET /workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/strategy`
  - `PUT /workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/strategy`
  - `POST /workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/strategy/complete`
- Strategy editing/completion requires a completed/current Brief.
- Completing Strategy marks Strategy completed and unlocks Visuals.
- Editing confirmed Strategy marks Visuals/Assets/Finalize stale without deleting content.

## Verification

- `pnpm --filter @wuzzify/brand-identity-api typecheck`
- `pnpm --filter @wuzzify/brand-identity-api lint`
- `pnpm --filter @wuzzify/brand-identity-api test -- strategy-completion.spec.ts brief-completion.spec.ts generation-support.spec.ts openrouter-chat-transport.spec.ts ai-policy-support.spec.ts`

## Known limitation

- Database-backed migration/API integration execution is pending because Docker Desktop is not running in this environment.

## Out of scope

- AI generation and Strategy UI.
