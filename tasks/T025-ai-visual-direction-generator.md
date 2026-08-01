# T025 — AI visual-direction generator

**Status:** Implemented, pending Docker/OpenRouter integration execution  
**Phase:** F — Visuals and assets  
**Depends on:** T017, T022, T024  
**Estimated size:** 2 days

## Objective

Generate 2–3 distinct, strategically grounded visual directions with colors, typography roles, and creative guidance.

## Scope

- `VisualDirectionGenerator` for full direction batches and variations.
- Strict schema/prompt plus post-generation color/font/domain validation.
- No image creation yet; produce image-generation prompt specifications/artifacts for T026.

## Required implementation

1. Build input from confirmed Brief and Strategy, with selected languages/scripts and constraints.
2. Require distinct theses, rationale, keywords, mood, principles, palette, type roles, imagery, iconography, layout, shapes, spacing, texture, motion, accessibility, and avoid-list.
3. Prevent requests to copy named protected logos; references describe abstract attributes only.
4. Validate/normalize colors and detect materially duplicate directions.
5. Verify recommended fonts against an approved catalog/metadata source; mark license `UNKNOWN` instead of inventing it.
6. Persist the full batch atomically and link run provenance.
7. Variation generation must retain the parent direction context without silently selecting it.

## Acceptance criteria

- [x] Generated directions are structurally complete and meaningfully distinct.
- [x] Bilingual inputs produce suitable script/font roles.
- [x] Invalid colors/fonts/duplicates are repaired through bounded validation handling or rejected safely.
- [x] Existing selected direction is never replaced automatically.

## Required tests

- Golden bilingual/RTL fixtures, distinctness checks, prohibited-copy prompt checks, invalid font/color output, and variation behavior.

## Implementation notes

- Added worker `VisualDirectionGenerator` for `VISUAL_DIRECTIONS_GENERATE` and `VISUAL_VARIATION_GENERATE`.
- Generator builds context only from confirmed Brief and confirmed Strategy, plus optional parent direction for variations.
- Prompt requires distinct theses, rationale, mood, principles, palette, typography, imagery, iconography, layout, shapes, spacing, texture, motion, accessibility, avoid-list, and future image prompt spec.
- Prompt forbids copying/imitating named protected logos; references must describe abstract attributes only.
- Added visual normalizer with deterministic color parsing/contrast, font catalog validation, duplicate color token detection, direction distinctness checks, and protected-copy rejection.
- Font catalog currently approves `Inter`, `Noto Sans Arabic`, `Noto Kufi Arabic`, and `System UI`; unknown font licenses are normalized to `UNKNOWN`.
- Generated visual direction batches persist atomically as new directions and never auto-select/replace an existing selected direction.

## Verification

- `pnpm --filter @wuzzify/brand-identity-worker typecheck`
- `pnpm --filter @wuzzify/brand-identity-worker lint`
- `pnpm --filter @wuzzify/brand-identity-worker test`
- `pnpm --filter @wuzzify/brand-identity-api typecheck`
- `pnpm --filter @wuzzify/brand-identity-api lint`
- `pnpm --filter @wuzzify/brand-identity-api test -- visual-validation.spec.ts`

## Known limitation

- End-to-end worker execution against PostgreSQL/Redis/OpenRouter is pending because local Docker Desktop is not running and no real OpenRouter request was executed during tests.

## Out of scope

- Image generation and font license purchasing.
