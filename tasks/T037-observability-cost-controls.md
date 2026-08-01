# T037 — Observability and AI cost controls

**Status:** Partially implemented, pending external telemetry/dashboards  
**Phase:** H — Platform hardening  
**Depends on:** T017 and all async/export/upload tasks  
**Estimated size:** 1–2 days

## Objective

Make request, authentication, generation, storage, export, abuse, and cost behavior measurable and enforce workspace AI budgets.

## Scope

- Structured logs, metrics, traces, dashboards/alerts, AI usage/cost aggregation, and budget guard.
- Correlation IDs across HTTP, queue, OpenRouter, storage, and outbox.

## Required implementation

1. Emit metrics listed in section 18 with bounded-cardinality labels.
2. Propagate request/job/run/project/version/workspace IDs through asynchronous work.
3. Add traces around database, OpenRouter, image ingestion, scanning, rendering, and event publication without recording sensitive bodies.
4. Calculate estimated cost from actual usage/model price snapshot and aggregate per workspace/month/task.
5. Enforce 70/90/100% notifications and a hard paid-generation limit while leaving manual edits available.
6. Add per-task candidate/image ceilings and premium-tier authorization.
7. Create alerts/runbooks for auth replay, queue backlog, generation validation spikes, scan failures, CDN abuse, export failures, and outbox lag.

## Acceptance criteria

- [x] Jobs carry workspace/project/version/job IDs in stored generation state; external tracing remains pending.
- [x] Hard budget blocks new paid work deterministically and returns actionable error.
- [x] Usage endpoint avoids metrics labels with raw user/project IDs.
- [ ] Dashboards and alert thresholds remain pending production observability setup.

## Required tests

- API typecheck/lint/test pass.
- Cost math, monthly boundary, concurrency near hard limit, manual-edit availability, log redaction, and telemetry smoke tests remain pending.

## Implementation notes

- Added AI monthly budget and precharge environment settings.
- Generation creation now checks current-month estimated AI spend before creating new paid jobs.
- Added owner-only monthly AI usage endpoint with task/tier rollups and 70/90/100% threshold flags.

## Out of scope

- Billing/payment collection.
