# T013 — Identity project and version APIs

**Status:** Implemented, pending Docker integration execution  
**Phase:** C — Identity project foundation  
**Depends on:** T012, T010  
**Estimated size:** 1–2 days

## Objective

Implement workspace-scoped project CRUD, version listing/read, and new-draft cloning foundations.

## Scope

- Project/version endpoints from section 10.
- Permission checks, optimistic locking, pagination, and stage summary DTOs.
- Create project + initial version transaction.

## Required implementation

1. Implement create/list/get/rename/archive project services and controllers.
2. Generate collision-safe slugs per workspace.
3. Create first draft version and stages in one transaction.
4. Implement paginated list filters by status/parent project and stable ordering.
5. Add version detail containing status/stage summary without eager-loading all content.
6. Add draft cloning contract; initially clone only records that exist, with feature aggregates extended by later tasks.

## Acceptance criteria

- [ ] Role permissions match the matrix.
- [ ] Every lookup is workspace-scoped and returns 404 rather than leaking foreign existence.
- [ ] Stale `lockVersion` mutations return 409.
- [ ] Project creation is idempotent when an idempotency key is supplied.
- [ ] OpenAPI and shared contracts are updated.

## Required tests

- API integration tests for CRUD, pagination, permissions, isolation, idempotency, and conflicts.

## Out of scope

- Activation/approval and feature aggregate cloning details.

## Implementation notes

- Added workspace-scoped identity project controller/service under `/v1/workspaces/:workspaceId/brand-identities`.
- Added create/list/get/update/archive project APIs guarded by live workspace membership and role checks.
- Project creation creates the first draft version and five workflow stages in one transaction.
- Added version listing with stage summaries and initial draft clone endpoint.
- Lookups are workspace-scoped and return domain 404s for foreign or missing projects.
- Full API isolation/idempotency/conflict integration execution is pending Docker daemon availability.
