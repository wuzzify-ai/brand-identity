# T022 — AI Strategy generator

**Status:** Implemented, pending Docker/OpenRouter integration execution  
**Phase:** E — Brief and strategy  
**Depends on:** T015, T017, T019, T021  
**Estimated size:** 2 days

## Objective

Generate a coherent, editable brand strategy and safely regenerate individual sections from the confirmed Brief.

## Scope

- `StrategyGenerator` for full and section-specific tasks.
- Strict output schemas for positioning, value proposition, mission, vision, values, personas, pillars, taglines, and rules.
- Consistency/domain review before persistence.

## Required implementation

1. Build prompts only from the saved confirmed Brief and requested languages.
2. Require evidence/assumption labeling and prevent invented market/legal claims.
3. Generate the minimum planned counts with non-duplicate, distinct content.
4. Validate contradictions against Brief constraints and near-duplicates within generated collections.
5. Regenerate only the target section while preserving user-edited unrelated sections.
6. Persist atomically with provenance and AI run linkage.
7. Optionally run the configured cross-model quality review in PREMIUM tier and store its report artifact.

## Acceptance criteria

- [x] Full output satisfies Strategy completion shape for valid detailed briefs.
- [x] Positioning components and final statement agree.
- [x] Taglines carry language and legal-review markers.
- [x] Section regeneration cannot overwrite other sections.
- [x] Contradictory/invalid output is rejected without destroying the last good Strategy.

## Required tests

- Golden fixtures for bilingual, B2B, and sparse inputs; duplicate/contradiction/malformed-output tests; section isolation tests.

## Implementation notes

- Added `StrategyGenerator` registered through `StageGeneratorFactory` for `STRATEGY_GENERATE` and `STRATEGY_SECTION_REGENERATE`.
- Generator reads only the saved confirmed Brief aggregate before prompting.
- Prompt rules prevent invented competitors, market/legal claims, awards, certifications, and require evidence/assumption-safe language.
- Strict output schema covers positioning, value proposition, mission, vision, values, personas, messaging pillars, taglines, and rules.
- Normalizer rejects duplicate values/personas/pillars/taglines and obvious contradictions with Brief constraints.
- Full generation replaces the full strategy aggregate; section regeneration only replaces the requested section.
- Persistence runs inside the worker success transaction after validation.
- Taglines include `languageCode`, `isSelected`, and `legalReviewRequired`.

## Verification

- `pnpm --filter @wuzzify/brand-identity-worker typecheck`
- `pnpm --filter @wuzzify/brand-identity-worker lint`
- `pnpm --filter @wuzzify/brand-identity-worker test`
- `pnpm --filter @wuzzify/brand-identity-api typecheck`
- `pnpm --filter @wuzzify/brand-identity-api lint`
- `pnpm --filter @wuzzify/brand-identity-api test -- strategy-completion.spec.ts`

## Known limitation

- End-to-end worker execution against PostgreSQL/Redis/OpenRouter is pending because local Docker Desktop is not running and no real OpenRouter request was executed during tests.

## Out of scope

- Trademark clearance and Strategy UI.
