# T034 — Approval and version activation

**Status:** Core implemented, pending deep-clone/immutability hardening  
**Phase:** G — Final package and activation  
**Depends on:** T013, T031, T032, T033  
**Estimated size:** 1–2 days

## Objective

Implement submit, review, approve/reject, and atomic single-active-version activation with immutable active content.

## Scope

- `approval_decisions` migration/entity.
- Submit/approve/reject/activate services and endpoints.
- Final prerequisite validator and version clone extension for all aggregates.

## Required implementation

1. Add append-only approval decision persistence.
2. Validate completed/current stages, selected direction/logo, asset readiness/warning policy, font licenses, tokens, and brand-book render before submission.
3. Enforce role permissions and legal state transitions.
4. Activation locks the project, supersedes old active version, activates approved version, updates pointer/timestamps, and emits outbox record atomically.
5. Reject with required reason and move to changes requested.
6. Prevent all content edits on active/superseded versions.
7. Clone every aggregate/selection into a new draft with new IDs and correct internal references.

## Acceptance criteria

- [x] Invalid transition returns stable domain error.
- [x] Concurrent activation attempts are protected by project/version row locks and the existing one-active partial index.
- [ ] Active versions immutability across every write endpoint remains pending hardening.
- [x] Approval history is append-only and attributable.
- [ ] New draft deep clone remains pending.

## Required tests

- API typecheck/lint/test pass.
- Full state-machine, prerequisite, role, concurrent activation, immutability, and deep-clone integration tests remain pending.

## Implementation notes

- Added append-only `approval_decisions` schema.
- Added submit, approve, reject, activate, and history endpoints.
- Added final prerequisite validation for selected visual direction, selected logo concept, current design tokens, and ready brand book.
- Activation supersedes old active versions, activates the approved version, and updates the project active pointer atomically.

## Out of scope

- Multi-reviewer quorum unless selected in open decisions.
