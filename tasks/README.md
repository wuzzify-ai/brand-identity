# Brand Identity Creator — Implementation Task Index

This directory converts [PROJECT_PLAN.md](../PROJECT_PLAN.md) into small, ordered implementation tasks. Each task is intended to be completed in one focused LLM coding session or a small pull request.

## How an implementation agent should use these files

1. Read `PROJECT_PLAN.md`, this index, and the selected task file completely.
2. Inspect the repository before changing anything; do not assume the planned directories already exist.
3. Confirm every dependency task is complete in the codebase, not only checked in this document.
4. Implement only the selected task and its necessary supporting changes.
5. Preserve existing user changes and follow repository `AGENTS.md` instructions.
6. Add migrations instead of using TypeORM `synchronize: true`.
7. Run the task’s required checks and report exact commands/results.
8. Update the task checkbox only when all acceptance criteria pass.

## Shared engineering rules

- TypeScript strict mode; avoid `any` unless isolated and justified.
- NestJS controllers validate/map requests; business rules belong in services/domain code.
- Next.js never receives OpenRouter, storage, JWT-signing, or email-provider secrets.
- Every protected query is workspace-scoped through a current active membership.
- Store password/token hashes only; never log secrets or raw authentication tokens.
- AI text output uses strict JSON Schema plus domain validation before persistence.
- Generated/uploaded files are ingested into owned storage; provider URLs are not durable assets.
- Mutations use idempotency and/or optimistic locking where the plan requires it.
- Add unit/integration tests proportional to the task; do not leave placeholder tests.
- Update OpenAPI/contracts and documentation when an API or event changes.

## Status legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete and verified
- `[!]` Blocked; add the blocker inside the task file

## Ordered backlog

### Phase A — Foundation

- [ ] [T001 — Scaffold monorepo](T001-scaffold-monorepo.md)
- [ ] [T002 — Local infrastructure and configuration](T002-local-infrastructure-and-config.md)
- [ ] [T003 — NestJS API foundation](T003-nest-api-foundation.md)
- [ ] [T004 — Next.js web foundation](T004-next-web-foundation.md)

### Phase B — Users and authentication

- [ ] [T005 — Auth and workspace database migration](T005-auth-workspace-database.md)
- [ ] [T006 — User profile module](T006-user-profile-module.md)
- [ ] [T007 — Registration and email verification](T007-registration-email-verification.md)
- [ ] [T008 — Login, JWT, and refresh rotation](T008-login-jwt-refresh.md)
- [ ] [T009 — Password recovery and session management](T009-password-recovery-sessions.md)
- [ ] [T010 — Workspace RBAC and invitations](T010-workspace-rbac-invitations.md)
- [ ] [T011 — Authentication and onboarding UI](T011-auth-onboarding-ui.md)

### Phase C — Identity project foundation

- [ ] [T012 — Identity project/version database](T012-identity-project-version-database.md)
- [ ] [T013 — Identity project/version APIs](T013-identity-project-version-api.md)
- [ ] [T014 — Identity workspace shell UI](T014-identity-workspace-shell.md)

### Phase D — AI platform

- [ ] [T015 — Prompt templates and model policies](T015-prompt-model-policies.md)
- [ ] [T016 — OpenRouter structured-text transport](T016-openrouter-text-transport.md)
- [ ] [T017 — Generation jobs, workers, and SSE](T017-generation-jobs-workers-sse.md)

### Phase E — Brief and strategy

- [ ] [T018 — Brief persistence and API](T018-brief-persistence-api.md)
- [ ] [T019 — AI brief generator](T019-ai-brief-generator.md)
- [ ] [T020 — Brief editor UI](T020-brief-editor-ui.md)
- [ ] [T021 — Strategy persistence and API](T021-strategy-persistence-api.md)
- [ ] [T022 — AI strategy generator](T022-ai-strategy-generator.md)
- [ ] [T023 — Strategy editor UI](T023-strategy-editor-ui.md)

### Phase F — Visuals and assets

- [ ] [T024 — Visual-direction persistence and API](T024-visual-direction-persistence-api.md)
- [ ] [T025 — AI visual-direction generator](T025-ai-visual-direction-generator.md)
- [ ] [T026 — OpenRouter image transport and ingestion](T026-openrouter-image-transport.md)
- [ ] [T027 — Visual-directions UI](T027-visual-directions-ui.md)
- [ ] [T028 — Asset upload and processing pipeline](T028-asset-upload-processing.md)
- [ ] [T029 — Public CDN and anonymous uploads](T029-public-cdn-anonymous-uploads.md)
- [ ] [T030 — AI logo concept generator](T030-ai-logo-concept-generator.md)
- [ ] [T031 — Asset manager UI](T031-asset-manager-ui.md)

### Phase G — Final package and activation

- [ ] [T032 — Design-token compiler](T032-design-token-compiler.md)
- [ ] [T033 — Brand-book generation and exports](T033-brand-book-generation.md)
- [ ] [T034 — Approval and version activation](T034-approval-version-activation.md)
- [ ] [T035 — Finalize and approval UI](T035-finalize-approval-ui.md)

### Phase H — Platform hardening

- [ ] [T036 — Audit log and transactional outbox](T036-audit-outbox.md)
- [ ] [T037 — Observability and AI cost controls](T037-observability-cost-controls.md)
- [ ] [T038 — Security and tenant-isolation hardening](T038-security-tenant-hardening.md)
- [ ] [T039 — Full test suites and CI gates](T039-tests-ci.md)
- [ ] [T040 — Deployment and production readiness](T040-deployment-production-readiness.md)

## Dependency flow

```text
T001 -> T002 -> T003/T004
T003 -> T005 -> T006 -> T007 -> T008 -> T009 -> T010 -> T011
T005/T010 -> T012 -> T013 -> T014
T003 -> T015 -> T016 -> T017
T012/T017 -> T018 -> T019 -> T020
T018/T019 -> T021 -> T022 -> T023
T021/T022 -> T024 -> T025
T025 -> T026 -> T027
T024/T026 -> T028 -> T029/T030 -> T031
T024/T030 -> T032 -> T033 -> T034 -> T035
All feature tasks -> T036/T037/T038 -> T039 -> T040
```

Tasks on the same branch should still be completed sequentially unless they edit clearly separate packages and their prerequisites are already merged.

