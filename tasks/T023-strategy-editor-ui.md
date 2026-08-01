# T023 — Strategy editor UI

**Status:** Implemented, pending end-to-end execution  
**Phase:** E — Brief and strategy  
**Depends on:** T020, T021, T022  
**Estimated size:** 2 days

## Objective

Build an editable Strategy workspace with section generation, comparisons, selection, and completion guidance.

## Scope

- Editors for positioning, value proposition, mission/vision, values, personas, pillars, taglines, and voice/rules.
- Generate all/regenerate section/add manually/compare/complete actions.

## Required implementation

1. Split large strategy into accessible collapsible sections with clear completion state.
2. Support stable list CRUD/reordering and selected taglines per language.
3. Display AI generation history/comparison without treating old output as canonical.
4. Show legal/trademark review warning beside taglines.
5. Use autosave/conflict/offline patterns established by T020.
6. Show server completion checklist and stale warning when Brief changes.
7. Keep unrelated sections editable during a section-generation job.

## Acceptance criteria

- [x] Every strategy component can be generated, edited, or entered manually.
- [x] Section regeneration visibly affects only its requested section.
- [x] Selected tagline and ordering persist across refresh.
- [x] Completing Strategy unlocks Visuals from server state.

## Required tests

- Component tests for each editor/list/selection/state.
- E2E full generation, manual completion, section regeneration, conflict, and bilingual flows.

## Implementation notes

- Added `StrategyEditor` with collapsible sections for foundation, values, personas, messaging pillars, taglines, and brand rules.
- Added stable list CRUD/reorder controls via React Hook Form field arrays.
- Added selected tagline and legal/trademark review controls.
- Added generate-all and section-regeneration actions through durable generation jobs.
- Added completion checklist, conflict reload, AI status, provenance labels, and save/complete actions.
- Embedded Strategy editor below Brief in the identity project workspace and refreshes workflow stages after completion.
- Added `strategy-api` client helpers and generation client support for `STRATEGY_GENERATE` / `STRATEGY_SECTION_REGENERATE`.

## Verification

- `pnpm --filter @wuzzify/brand-identity-web typecheck`
- `pnpm --filter @wuzzify/brand-identity-web lint`
- `pnpm --filter @wuzzify/brand-identity-web test`

## Known limitation

- Browser/E2E journeys are pending because the local API/PostgreSQL/Redis stack is not running.

## Out of scope

- Visual direction generation.
