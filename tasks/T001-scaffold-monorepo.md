# T001 — Scaffold the monorepo

**Status:** Implemented  
**Phase:** A — Foundation  
**Depends on:** None  
**Estimated size:** 1 focused development day

## Objective

Create a runnable TypeScript monorepo containing the Next.js web app, NestJS API, worker entry point, and shared packages described in the plan.

## Scope

- Choose the parent repository’s existing package manager/workspace system when present; otherwise use `pnpm` workspaces.
- Create `apps/web`, `apps/api`, and `apps/worker`.
- Create shared `packages/contracts`, `packages/ai-schemas`, `packages/design-tokens`, and shared TypeScript/ESLint configuration.
- Enable strict TypeScript, formatting, linting, and consistent scripts from the repository root.

## Required implementation

1. Inspect the repository and preserve existing tooling/conventions.
2. Scaffold Next.js with App Router and NestJS API/worker applications.
3. Add root scripts for `dev`, `build`, `lint`, `typecheck`, and `test`.
4. Configure workspace imports without publishing packages.
5. Add a minimal README explaining local commands.
6. Ensure generated example code is removed or reduced to health placeholders.

## Acceptance criteria

- [ ] One install command installs every workspace dependency.
- [ ] Web, API, and worker compile independently and from the root.
- [ ] Lint and typecheck run from the root with strict TypeScript enabled.
- [ ] Shared packages can be imported by apps without relative path hacks.
- [ ] No secrets or machine-specific paths are committed.

## Required tests

- Run install, lint, typecheck, test, and production build.
- Start each app once and confirm it reaches its placeholder health state.

## Out of scope

- Database, authentication, OpenRouter, and business features.

## Implementation notes

- Implemented the pnpm monorepo with `apps/web`, `apps/api`, `apps/worker`, and shared packages.
- Root `lint`, `typecheck`, `test`, and `build` commands are wired and passing.
- Web was started locally and confirmed at `http://localhost:3000`.
