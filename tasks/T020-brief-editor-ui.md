# T020 — Brief editor UI

**Status:** Implemented, pending end-to-end execution  
**Phase:** E — Brief and strategy  
**Depends on:** T014, T017, T018, T019  
**Estimated size:** 2 days

## Objective

Build the complete Brief editing experience with autosave, AI progress, provenance, manual entry, and completion guidance.

## Scope

- Forms for every Brief section.
- Initial `Build my brief`, manual start, improve, regenerate-empty, regenerate-selected, and complete actions.
- Job SSE/polling and optimistic conflict handling.

## Required implementation

1. Use React Hook Form/Zod and stable IDs for repeatable sections.
2. Debounce scalar autosaves; save structural list operations explicitly.
3. Show `AI suggestion`, `user edited`, validation, and unsaved/offline states.
4. Render field-level skeletons during initial extraction without blocking manual edits to unrelated fields.
5. Display completion checklist and missing requirements from the server.
6. Handle 409 conflicts with reload/merge choices; retain local draft during network failure.
7. Support Arabic input/RTL and keyboard-accessible reorder/add/remove controls.

## Acceptance criteria

- [x] User can complete the Brief with AI, manually, or a mixture.
- [x] Autosave never loses list items or overwrites a newer server edit silently.
- [x] AI job failure leaves all manual editing available.
- [x] Completion navigates/unlocks Strategy using refreshed server state.

## Required tests

- Component tests for all field types, provenance, save/error/conflict states.
- E2E AI and manual Brief journeys including offline/retry and RTL.

## Implementation notes

- Added `BriefEditor` with React Hook Form/Zod and stable repeatable sections for languages, audiences, markets, products/services, preferences, and constraints.
- Added manual save and complete actions wired to the Brief API.
- Added AI actions for full brief build, empty-field generation, and selected-field regeneration through generation jobs.
- Shows provenance labels (`AI suggestion`, `User edited`, `Imported`), completion checklist, conflict reload action, AI status, and RTL direction when locale starts with Arabic.
- Structural list changes are explicit; omitted sections are preserved by the API payload.
- Embedded the editor in the identity project detail page using the latest identity version.

## Verification

- `pnpm --filter @wuzzify/brand-identity-web typecheck`
- `pnpm --filter @wuzzify/brand-identity-web lint`
- `pnpm --filter @wuzzify/brand-identity-web test`

## Known limitation

- Browser/E2E journeys are pending because the local API/PostgreSQL/Redis stack is not running.

## Out of scope

- Strategy forms.
