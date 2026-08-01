# T039 — Full test suites and CI quality gates

**Status:** Implemented, pending DB/E2E/security scan expansion  
**Phase:** H — Platform hardening  
**Depends on:** T001–T038  
**Estimated size:** 2 days

## Objective

Close cross-feature test gaps and enforce repeatable CI gates for build, database, API, worker, web, security, and visual output.

## Scope

- Root CI workflow, test sharding/caching, Testcontainers, browser E2E, contract tests, PDF/visual snapshots, and coverage policy.

## Required implementation

1. Inventory acceptance criteria from every prior task and map each to an automated test or explicit manual release check.
2. Run format/lint/typecheck/unit/integration/contract/E2E/build/migration/security scans in CI.
3. Test migrations from empty database and previous release snapshot; test rollback where supported.
4. Add OpenAPI breaking-change detection and AI JSON Schema golden fixtures.
5. Add Playwright journeys for auth through activation plus anonymous upload.
6. Add deterministic HTML/PDF/RTL visual regression baselines.
7. Set meaningful package-specific coverage thresholds while prioritizing domain branches over generated files.
8. Upload sanitized logs/screenshots/artifacts only on failure.

## Acceptance criteria

- [x] A fresh CI runner has a defined install/verify workflow without hidden local dependencies.
- [x] Required gates block merge on failure.
- [x] Default tests are isolated, repeatable, and free of real paid AI calls.
- [ ] Critical DB/E2E/security workflow cases remain pending expansion.
- [x] CI duration and flaky-test policy are documented.

## Required tests

- Added `pnpm ci:verify`.
- Added GitHub Actions workflow.
- Added `docs/TEST_AND_CI_PLAN.md`.
- Ran `pnpm ci:verify` locally successfully.
- Clean-branch hosted validation and intentional failure proof remain pending.

## Out of scope

- Production deployment.
