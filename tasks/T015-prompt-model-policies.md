# T015 — Prompt templates, AI schemas, and model policies

**Status:** Implemented  
**Phase:** D — AI platform  
**Depends on:** T003, T005  
**Estimated size:** 1–2 days

## Objective

Create versioned prompt-template/model-policy persistence and typed task contracts for every planned AI operation.

## Scope

- `ai_prompt_templates` and `ai_model_policies` migration/entities/repositories.
- `GenerationTask`, modality, and tier contracts.
- Seed migration/data for current OpenRouter model policies from section 7.

## Required implementation

1. Create reversible migration with active-policy/template partial unique indexes.
2. Keep referenced templates/policies immutable; retire and insert new versions.
3. Define strict input/output JSON Schemas in `packages/ai-schemas` for each task, starting with complete schema identifiers even if feature implementation comes later.
4. Seed FAST/BALANCED/PREMIUM policies using configurable model slugs and provider preferences.
5. Implement admin/internal resolution service by `(task, tier, effective time)`.
6. Hash canonical prompt/schema content to detect accidental mutation.

## Acceptance criteria

- [x] Exactly one active template per task and one current policy per task/tier.
- [x] Retired records remain readable by historical runs.
- [x] Schemas compile and reject unknown properties where strictness is required.
- [x] Model changes require configuration/seed changes, not generator code changes.

## Required tests

- Migration constraints, policy resolution boundaries, canonical hashing, and schema fixture tests.

## Implementation notes

- Added `AiModule` with an internal `AiPolicyService` that resolves current OpenRouter model policy plus active prompt template by `(task, tier, effective time)`.
- Added reversible migration for `ai_prompt_templates` and `ai_model_policies`, including partial unique indexes for active/current rows.
- Seeded all declared generation tasks with FAST/BALANCED/PREMIUM OpenRouter policies.
- Verified current OpenRouter model slugs on 2026-07-21 and seeded:
  - text: `openai/gpt-5.6-luna`, `openai/gpt-5.6-terra`, `openai/gpt-5.6-sol`
  - image: `openai/gpt-5-image-mini`, `openai/gpt-image-2`, `openai/gpt-5-image`
  - fallback text alias: `~anthropic/claude-sonnet-latest`
- Added strict AI task contracts in `packages/ai-schemas` for brief, strategy, visuals, logos, brand-book narrative, and quality review.
- Added canonical JSON/SHA-256 hashing support for prompt/schema mutation detection.

## Verification

- `pnpm --filter @wuzzify/brand-ai-schemas typecheck`
- `pnpm --filter @wuzzify/brand-ai-schemas test`
- `pnpm --filter @wuzzify/brand-identity-api typecheck`
- `pnpm --filter @wuzzify/brand-identity-api lint`
- `pnpm --filter @wuzzify/brand-identity-api test -- ai-policy-support.spec.ts`

## Known limitation

- Docker Desktop is not running in this environment, so database-backed migration integration execution remains pending.

## Out of scope

- Calling OpenRouter and implementing stage prompts.
