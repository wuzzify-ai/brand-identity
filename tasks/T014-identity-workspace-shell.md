# T014 — Identity workspace shell UI

**Status:** Implemented, pending end-to-end execution  
**Phase:** C — Identity project foundation  
**Depends on:** T004, T011, T013  
**Estimated size:** 1–2 days

## Objective

Build project listing/creation and the shared staged workspace shell used by Brief, Strategy, Visuals, Assets, and Finalize pages.

## Scope

- `/brand-identities`, `/new`, and `[projectId]` layout/navigation.
- Version selector, stage state, completion panel, save status, and role-aware actions.

## Required implementation

1. Build paginated project list with loading/empty/error states.
2. Build initial textarea entry plus `Build my brief` and `Start manually` flows; AI submission is wired later.
3. Render stage navigation from API state rather than client assumptions.
4. Prevent navigation into locked stages while preserving direct-route error handling.
5. Add version selector and read-only treatment for active/archived versions.
6. Provide responsive desktop/mobile and RTL layouts.

## Acceptance criteria

- [ ] User can create a manual project and enter its Brief stage.
- [ ] Locked/stale/generating/failed/completed states are visually distinct.
- [ ] Viewer role cannot see mutation controls.
- [ ] Refresh/deep links preserve selected project/version/stage.

## Required tests

- Component tests for every stage state and role.
- E2E project creation, listing, navigation, and read-only version behavior.

## Out of scope

- Stage-specific forms and AI progress implementation.

## Implementation notes

- Added `/brand-identities`, `/brand-identities/new`, and `/brand-identities/[projectId]` web routes.
- Added identity API client and staged workspace shell that renders stage state from API version summaries.
- Added initial business-description textarea with `Build my brief` and `Start manually` submit flows.
- Added project list loading/empty/error states and responsive shell layout.
- Full browser E2E project creation/navigation execution is pending a running API/database environment.
