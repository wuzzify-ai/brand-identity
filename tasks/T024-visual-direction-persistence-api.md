# T024 — Visual-direction persistence and API

**Status:** Implemented, pending Docker integration execution  
**Phase:** F — Visuals and assets  
**Depends on:** T021, T022  
**Estimated size:** 1–2 days

## Objective

Implement editable visual directions, colors, fonts, selection, validation, and Visual-stage workflow rules.

## Scope

- `visual_directions`, `visual_colors`, and `visual_fonts` migration/entities.
- List/read/update/select/archive endpoints.
- Deterministic color/font validation services.

## Required implementation

1. Add migration with HEX, token-name, selected-direction, font weight, and index constraints.
2. Implement aggregate updates with stable IDs and optimistic locking.
3. Enforce exactly zero or one selected direction per identity version.
4. Parse colors and derive RGB/HSL; calculate contrast deterministically.
5. Validate font roles, weights, supported language/script metadata, source, and license status.
6. Require completed, non-stale Brief and Strategy for normal Visual generation/selection.
7. Selecting a direction unlocks Assets; changing it marks asset/final outputs stale.

## Acceptance criteria

- [x] Multiple directions can coexist but only one is selected.
- [x] Invalid HEX/font weights/token duplicates fail with field errors.
- [x] Contrast results come from code, not stored AI claims.
- [x] Selection is atomic and workspace-authorized.
- [x] Stale propagation preserves existing visual/asset data.

## Required tests

- Migration constraints, color math fixtures, font validation, aggregate conflicts, selection race, and workflow gates.

## Implementation notes

- Added `visual_directions`, `visual_colors`, and `visual_fonts` migration/schema.
- Added partial unique index enforcing zero-or-one selected visual direction per identity version.
- Added HEX and token-name DB constraints plus deterministic RGB/HSL/contrast derivation in code.
- Added font role/weight validation for roles, 100..900 weights, scripts, source, and license status.
- Added Visual Directions API:
  - `GET /workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/visual-directions`
  - `POST /workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/visual-directions`
  - `GET /workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/visual-directions/:directionId`
  - `PUT /workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/visual-directions/:directionId`
  - `POST /workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/visual-directions/:directionId/select`
  - `DELETE /workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/visual-directions/:directionId`
- Visual editing/selection requires completed Strategy.
- Selecting a visual direction completes Visuals and unlocks Assets; changing selected visuals marks Assets/Finalize stale without deleting data.

## Verification

- `pnpm --filter @wuzzify/brand-identity-api typecheck`
- `pnpm --filter @wuzzify/brand-identity-api lint`
- `pnpm --filter @wuzzify/brand-identity-api test -- visual-validation.spec.ts strategy-completion.spec.ts`

## Known limitation

- Database-backed migration/API integration execution is pending because Docker Desktop is not running in this environment.

## Out of scope

- AI generation, images, and UI.
