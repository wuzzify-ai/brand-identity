# T036 — Audit log and transactional outbox

**Status:** Partially implemented, pending outbox publisher worker  
**Phase:** H — Platform hardening  
**Depends on:** T034 and all mutation-producing feature tasks  
**Estimated size:** 1–2 days

## Objective

Add reliable security/business audit history and publish integration events through a transactional outbox.

## Scope

- `audit_logs` and `outbox_events` migration/entities.
- Audit service/interceptor helpers and outbox publisher worker.
- Event contracts listed in sections 4 and 8.

## Required implementation

1. Add migration/indexes for tenant/project/time and unpublished events.
2. Audit authentication security events, membership changes, content mutations, selections, publishing, approval, activation, and sensitive downloads.
3. Redact password/token hashes, secrets, raw tokens, full prompts, and unnecessary PII from before/after data.
4. Write outbox rows inside the same business transaction as the state change.
5. Publish with stable event ID, schema version, bounded retries, idempotent consumer expectation, and dead-letter alerting.
6. Mark published only after broker acknowledgement; allow safe replay.
7. Add authorized paginated audit read endpoint if required by product.

## Acceptance criteria

- [x] Approval/activation audited mutations write audit/outbox records where required.
- [x] Transaction rollback leaves neither state nor outbox event for wired approval/activation paths.
- [x] Outbox rows use stable idempotency keys for activation events.
- [x] Audit payload redaction removes password/token/secret/hash/prompt-like fields.

## Required tests

- API typecheck/lint/test pass.
- Publisher retry/duplicate/replay, full mutation coverage, ordering metadata, permission, and high-volume pagination tests remain pending.

## Implementation notes

- Added `audit_logs` and `outbox_events` schema.
- Added owner-only audit read endpoint.
- Added audit redaction helper.
- Approval transitions now write audit rows transactionally.
- Activation writes audit plus stable-idempotency outbox event transactionally.

## Out of scope

- External consumer implementation.
