# T040 — Deployment and production readiness

**Status:** Packaged/runbook ready, pending staging deployment rehearsal  
**Phase:** H — Platform hardening  
**Depends on:** T039  
**Estimated size:** 2 days

## Objective

Package, deploy, migrate, operate, back up, and safely roll back the complete system in production.

## Scope

- Production containers/manifests, secret references, migrations, worker scaling, storage/CDN/email/OpenRouter configuration, monitoring, backups, and runbooks.

## Required implementation

1. Build minimal non-root version-pinned web/API/worker images with health checks and read-only filesystem where possible.
2. Define environment-specific infrastructure using the parent platform’s approved deployment system.
3. Run migrations as a single controlled release job before incompatible app rollout; document expand/contract rules.
4. Configure private storage, quarantine, public CDN origin access, lifecycle cleanup, CORS, and cache behavior.
5. Configure Redis durability/queue recovery, worker concurrency, graceful shutdown, timeouts, and autoscaling.
6. Store/rotate JWT, token pepper, OpenRouter, storage, email, CAPTCHA, and broker secrets in a secrets manager.
7. Configure database backups/PITR and perform a restoration drill.
8. Create rollback, incident, provider outage, queue backlog, compromised key/session, abuse/takedown, and cost-spike runbooks.
9. Execute staging smoke/load/accessibility/security and launch checklist.

## Acceptance criteria

- [ ] Staging deployment completes from CI with no manual file edits — pending target platform.
- [ ] Migration and rollback/forward-fix procedures are rehearsed — documented, not rehearsed.
- [ ] Backup restoration meets documented RPO/RTO — placeholders documented, drill pending.
- [x] Provider outage degradation policy documents manual editing availability.
- [ ] Dashboards, alerts, ownership, on-call contacts, and runbooks are live before launch — pending platform setup.

## Required tests

- Added web/API/worker Dockerfiles.
- Added `.dockerignore`.
- Added `docs/DEPLOYMENT_RUNBOOK.md`.
- Staging deploy/migration/rollback smoke, load test, worker termination recovery, backup restore, secret rotation, CDN/upload, email, and OpenRouter outage exercises remain pending.

## Out of scope

- New product features after v1 launch.
