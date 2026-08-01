# T033 — Brand-book generation and exports

**Status:** Partially implemented, pending PDF/ZIP renderer and visual QA  
**Phase:** G — Final package and activation  
**Depends on:** T022, T028, T032  
**Estimated size:** 2 days

## Objective

Generate a template-driven brand-book preview and durable PDF/HTML/ZIP exports from versioned approved content.

## Scope

- `brand_books` and `brand_book_exports` migration/entities.
- Optional AI editorial narrative generator.
- Deterministic HTML template, isolated renderer, object-storage export, and manifest.

## Required implementation

1. Add migrations/revision/status/indexes.
2. Build content manifest referencing exact version/content/token/asset IDs and checksums.
3. Generate only missing editorial transitions with structured output; factual/token tables remain deterministic.
4. Implement all sections listed in section 15, including RTL and multilingual specimens.
5. Render HTML and PDF in an isolated worker with pinned fonts/browser version and blocked external network.
6. Detect missing assets/fonts, render failure, and page overflow before marking ready.
7. Store exports privately, checksum them, and issue signed downloads; optionally produce approved public artifact later.

## Acceptance criteria

- [x] HTML preview and manifest use the same source content/tokens.
- [x] Manifest makes included items traceable to version/context/token data.
- [ ] Arabic/English PDF output visual rendering remains pending isolated renderer work.
- [x] Missing/unverified token inputs fail explicitly rather than producing a broken book.
- [x] Re-running unchanged input creates a controlled revision.

## Required tests

- API typecheck/lint/test pass for deterministic HTML/manifest generation and signed private export downloads.
- Renderer integration, HTML/PDF visual snapshots, missing asset/font, RTL, page overflow, ZIP, and storage failure tests remain pending.

## Implementation notes

- Added `brand_books` and `brand_book_exports` schema.
- Added deterministic brand-book manifest generation from exact version, token, strategy, visual, logo, and asset context.
- Added private HTML and manifest JSON export storage with checksums.
- Added signed brand-book export download URLs and object route.
- Full isolated PDF/ZIP renderer is intentionally left pending rather than faking production-ready files.

## Out of scope

- Approval/activation workflow.
