# T030 — AI logo concept generator

**Status:** Implemented, pending real OpenRouter image integration execution  
**Phase:** F — Visuals and assets  
**Depends on:** T024, T026, T028  
**Estimated size:** 2 days

## Objective

Generate strategically grounded logo concepts and previews linked to the selected visual direction, with clear concept/review status.

## Scope

- `logo_concepts` migration/entity/endpoints.
- `LogoConceptGenerator`, image prompt construction, asset ingestion/linkage, selection/review states.
- Wordmark, lettermark, symbol, combination, emblem types.

## Required implementation

1. Add migration with one-selected-concept partial index and visual/version relations.
2. Validate selected current visual direction and brand/language/use-case inputs.
3. Generate concept names/rationales in structured text, then image previews through T026.
4. Prompt for originality and abstract strategic attributes; never copy named logos.
5. Produce normal, monochrome, and small-size preview requests where policy/budget permits.
6. Ingest all outputs as `REVIEW_REQUIRED` concept assets and link run provenance.
7. Implement shortlist/select/reject/archive and production notes; only reviewed/vectorized assets may be `PRODUCTION_READY`.

## Acceptance criteria

- [x] Every concept has rationale, type, language metadata, and at least one valid preview or explicit partial failure.
- [x] Only one concept is selected per version.
- [x] Selecting a concept does not label it production-ready.
- [x] Failed image generation preserves successful concept text/assets.
- [x] User sees trademark/font/vector review warnings in API data.

## Required tests

- Added worker unit coverage for preserving concept text and warnings when preview image generation fails.
- API and worker typecheck/lint/test pass.
- Full OpenRouter image, race-condition, permission, provenance, and stale-direction integration tests remain pending Docker/OpenRouter execution.

## Implementation notes

- Added `logo_concepts` and `logo_concept_assets` schema with selected-concept partial index.
- Added API endpoints for list/get/update/shortlist/select/reject/archive.
- Added worker `LogoConceptGenerator` registered under `LOGO_CONCEPTS_GENERATE`.
- Generator grounds prompts in confirmed brief, confirmed strategy, and the selected visual direction.
- Generated preview images are persisted as private `LOGO_CONCEPT` brand assets linked to each concept.

## Out of scope

- Legal trademark search and professional vector cleanup.
