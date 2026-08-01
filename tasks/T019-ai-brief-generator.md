# T019 — AI Brief generator

**Status:** Implemented, pending Docker/OpenRouter integration execution  
**Phase:** E — Brief and strategy  
**Depends on:** T015, T016, T017, T018  
**Estimated size:** 1–2 days

## Objective

Generate or improve a validated Brief from the user’s initial business description while preserving manual edits.

## Scope

- `BriefGenerator` implementation for `BRIEF_EXTRACT` and `BRIEF_IMPROVE`.
- Strict schema/prompt versions and normalized persistence mapping.
- Full, empty-field-only, and selected-field modes.

## Required implementation

1. Define schema fields for industry, languages, audiences, markets, offerings, positioning, preferences, constraints, assumptions, and confidence warnings.
2. Instruct the model to leave unknowns empty and never invent competitors/legal facts.
3. Include locale/RTL requirements and all user-provided constraints.
4. Validate BCP-47-like language tags, country codes, enum values, counts, lengths, and duplicates after JSON Schema validation.
5. Persist the result and provenance in one transaction only after validation.
6. For improve/regenerate modes, update only requested/empty targets; never overwrite unrelated user-edited content.
7. Update Brief stage job/state/progress and record actual AI run metadata.

## Acceptance criteria

- [x] A representative Arabic/English input produces all available structured sections.
- [x] Missing facts remain empty/assumptions rather than fabricated facts.
- [x] Selected-field generation cannot alter another field.
- [x] Validation failure preserves the last good Brief and returns actionable retry/manual options.

## Required tests

- Golden prompt/schema fixtures in English and Arabic.
- Generator integration tests for full extraction, partial update, malformed output, duplicate lists, and transport failure.

## Implementation notes

- Extended shared generated-brief schema/JSON contract with `assumptions` and `confidenceWarnings`.
- Added worker-side `AiPolicyResolverService` and `OpenRouterStructuredTextService` for policy-driven structured text generation.
- Added `BriefGenerator` registered through `StageGeneratorFactory` for `BRIEF_EXTRACT` and `BRIEF_IMPROVE`.
- Prompt instructions require empty unknowns, BCP-47-like language tags, locale/RTL awareness, and no invented competitors/legal/business facts.
- Added strict post-response validation/normalization for language tags, duplicate values, counts, and bounded lengths.
- Implemented full, empty-field-only, and selected-field persistence modes.
- Brief persistence runs inside the worker success transaction after validation, before artifact/job success is committed.
- Selected-field mode only mutates requested sections; empty-field mode only fills blank sections.

## Verification

- `pnpm --filter @wuzzify/brand-identity-worker typecheck`
- `pnpm --filter @wuzzify/brand-identity-worker lint`
- `pnpm --filter @wuzzify/brand-identity-worker test`
- `pnpm --filter @wuzzify/brand-ai-schemas typecheck`
- `pnpm --filter @wuzzify/brand-ai-schemas test`
- `pnpm --filter @wuzzify/brand-identity-api typecheck`
- `pnpm --filter @wuzzify/brand-identity-api lint`

## Known limitation

- End-to-end worker execution against PostgreSQL/Redis/OpenRouter is pending because local Docker Desktop is not running and no real OpenRouter request was executed during tests.

## Out of scope

- Strategy generation and research/web browsing.
