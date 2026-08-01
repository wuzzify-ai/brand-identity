# Test and CI Plan

## Automated CI gates

`pnpm ci:verify` runs:

1. Build shared design-token package so app typechecks consume current package declarations.
2. Workspace typecheck.
3. Workspace lint with zero warnings.
4. Workspace unit/contract tests.
5. Workspace builds.

The GitHub Actions workflow runs on pull requests and pushes to `main`/`develop` using Node 22 and pnpm 11.13.0.

## Current automated coverage

- Auth support, JWT/cookie behavior, registration support, workspace RBAC.
- Brief, strategy, visual validation/completion.
- OpenRouter structured text transport support.
- Generation support and worker normalizers.
- Image safe fetch and image transport ingestion support.
- Asset upload signing, MIME validation, unsafe SVG, malware-test signature rejection.
- Public anonymous upload URL safety.
- Logo concept partial image failure preservation.
- Design-token deterministic checksums and CSS/SCSS escaping.
- Security headers.
- Frontend API contract shapes for auth, brief, strategy, visual directions, assets, logo concepts, finalize support.

## Required manual or pending CI checks

- Docker-backed PostgreSQL migration from empty database and rollback smoke.
- Redis/BullMQ worker integration.
- MinIO/S3-compatible upload, scan, publish, signed download, and CDN-path integration.
- OpenRouter mocked integration for all generation workflows without paid calls.
- Browser E2E: auth, onboarding, brief, strategy, visuals, assets, anonymous upload review, token compile, brand book, approval, activation.
- PDF/HTML/RTL visual regression once the isolated renderer is implemented.
- IDOR/role matrix for every route and resource.
- Dependency/container vulnerability scanning and exception register.

## Flaky-test policy

- Tests that require network, paid AI calls, or Docker services must be opt-in and mocked in default CI.
- A flaky test must be quarantined with an owner, failure issue, and target removal date.
- Failure artifacts must not include raw tokens, upload grants, passwords, API keys, full prompts, or private uploaded content.
