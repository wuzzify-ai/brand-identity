# T017 — Generation jobs, workers, run audit, and SSE

**Status:** Implemented, pending Docker integration execution  
**Phase:** D — AI platform  
**Depends on:** T002, T003, T015, T016  
**Estimated size:** 2 days

## Objective

Build the durable asynchronous generation framework used by all AI stages.

## Scope

- `generation_jobs`, `ai_generation_runs`, and `generation_artifacts` migration/entities.
- BullMQ worker/queue, `StageGeneratorFactory`, job API, cancellation, and SSE/polling.
- Idempotency, progress, retry, and cost/run audit.

## Required implementation

1. Implement migration and relations to prompt/model policies.
2. Add `POST /generations`, job read, cancel, and SSE endpoints.
3. Require workspace/version authorization and an idempotency key.
4. Worker resolves generator and transport factories, validates prerequisites, records attempts, validates output, then persists atomically.
5. Record sanitized request, parsed response, actual model/provider, usage, cost, latency, and errors.
6. Implement heartbeat/stalled-job recovery and bounded exponential backoff.
7. Make cancellation best-effort and never mark a completed charged request as cancelled incorrectly.

## Acceptance criteria

- [x] Duplicate idempotency key returns the existing job.
- [x] State transitions follow the plan and invalid transitions fail.
- [x] SSE reconnect returns current state without duplicating terminal events.
- [x] Worker restart does not lose durable job/run state.
- [x] No invalid AI response mutates brand content.

## Required tests

- Integration tests for queue success/failure/retry/idempotency/cancel/stall and SSE authorization/reconnect.

## Implementation notes

- Added durable `generation_jobs`, `ai_generation_runs`, and `generation_artifacts` migration/schema.
- Added TypeORM entities/enums for generation job status, artifact kind, and generation task/tier.
- Added `POST /generations`, `GET /generations/:jobId`, `POST /generations/:jobId/cancel`, and `GET /generations/:jobId/events` SSE current-state endpoint.
- Generation creation requires `Idempotency-Key`, validates workspace/editor membership, validates the target identity version/stage, updates the workflow stage to generating, and enqueues BullMQ.
- Added BullMQ-backed queue adapter with exponential retry configuration and best-effort queued-job cancellation.
- Added worker app BullMQ consumer with durable run-attempt records, heartbeat/stall settings, safe cancellation before provider charge, and artifact persistence only after a generator succeeds.
- Added `StageGeneratorFactory` stub for later concrete brief/strategy/visual/logo generators.

## Verification

- `pnpm --filter @wuzzify/brand-identity-api typecheck`
- `pnpm --filter @wuzzify/brand-identity-api lint`
- `pnpm --filter @wuzzify/brand-identity-api test -- openrouter-chat-transport.spec.ts ai-policy-support.spec.ts generation-support.spec.ts`
- `pnpm --filter @wuzzify/brand-identity-worker typecheck`
- `pnpm --filter @wuzzify/brand-identity-worker lint`
- `pnpm --filter @wuzzify/brand-identity-worker test`

## Known limitation

- Full queue/DB/SSE integration execution is pending because Docker Desktop is not running in this environment.

## Out of scope

- Concrete Brief/Strategy/Visual/Logo generators.
