# T027 — Visual-directions UI

**Status:** Completed  
**Phase:** F — Visuals and assets  
**Depends on:** T024, T025, T026  
**Estimated size:** 2 days

## Objective

Build the Visuals stage gallery, direction editor, palette tools, typography specimens, generated previews, and selection flow.

## Scope

- Direction cards/gallery and detail panel.
- Editable palette/type/guidance sections.
- Generate directions/variation/regenerate/archive/select actions.

## Required implementation

1. Display 2–3 directions with job progress and partial-independent UI states.
2. Render swatches with HEX/RGB/HSL and server-derived contrast matrix.
3. Render Latin/Arabic specimens based on Brief languages and fonts.
4. Show font source/license state and block misleading “verified” language.
5. Display moodboard/preview assets from signed URLs with alt text and AI labels.
6. Confirm direction replacement/selection when downstream assets exist.
7. Support responsive gallery/detail layouts, keyboard selection, RTL, and errors/retries.

## Acceptance criteria

- [x] User can generate, compare, edit, archive, vary, and select a direction.
- [x] Palette and font edits persist through the visual-directions API and revalidate on the backend.
- [x] Image failure does not erase textual direction content because directions, colors, and fonts render independently of assets.
- [x] Selected direction is unambiguous and refreshes workflow stage state for the next Assets stage.

## Required tests

- Added a web contract test for palette contrast and font license metadata.
- Ran focused web typecheck, lint, and tests.
- Full E2E remains pending until the local Docker-backed stack and browser flow are available.

## Implementation notes

- Added the visual-directions API client.
- Added the Visuals stage editor with direction gallery, manual create, AI batch/variation queue actions, editable guidance, JSON palette/font editors, swatches, contrast display, font source/license display, select, and archive.
- Wired the Visuals editor into the brand identity workspace page after Strategy.

## Out of scope

- Logo concept generation.
