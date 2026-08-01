# T012 — Identity project, version, and workflow database

**Status:** Implemented, pending Docker integration execution  
**Phase:** C — Identity project foundation  
**Depends on:** T005, T010  
**Estimated size:** 1–2 days

## Objective

Create the project/version/workflow persistence foundation with immutable active versions and exactly one active version per project.

## Scope

- `identity_projects`, `identity_versions`, and `workflow_stages` migration/entities.
- Project status, version status, workflow stage enums, indexes, and FKs.
- Initial five-stage row creation.

## Required implementation

1. Translate the relevant plan DDL into a reversible migration.
2. Link projects to internal workspaces/users and retain optional external `parent_project_id`.
3. Enforce unique version numbers and the partial one-active-version index.
4. Model the active-version pointer safely; ensure it cannot point to another project in service/domain validation.
5. Add factories for the default stage states: Brief available; downstream stages locked.

## Acceptance criteria

- [ ] Migration up/down succeeds on PostgreSQL.
- [ ] Duplicate project slugs inside a workspace and duplicate version numbers fail.
- [ ] Two active versions for one project cannot be persisted.
- [ ] Project records from one workspace are not returned by another workspace repository.
- [ ] New version has exactly five workflow stage rows.

## Required tests

- Testcontainers constraint/index tests and repository tenant-scope tests.

## Out of scope

- Brief/strategy content tables and activation service behavior.

## Implementation notes

- Added identity project/version/workflow enums and TypeORM entities.
- Added reversible migration for `identity_projects`, `identity_versions`, and `workflow_stages`.
- Added partial unique indexes for workspace slug, public asset slug, and one active version per project.
- Added default five-stage factory: Brief `NOT_STARTED`, downstream stages `LOCKED`.
- Added factory tests for stage defaults and slug generation.
- PostgreSQL constraint/index integration execution is pending Docker daemon availability.
