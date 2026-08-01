# Deployment and Production Readiness Runbook

## Required services

- Web: Next.js app, horizontally scalable.
- API: NestJS HTTP API, horizontally scalable.
- Worker: NestJS/BullMQ worker, horizontally scalable by queue/concurrency.
- PostgreSQL 16 with PITR backups.
- Redis 7 with AOF enabled for BullMQ durability.
- Private S3-compatible object storage.
- Public CDN origin limited to approved immutable public asset paths.
- SMTP provider.
- OpenRouter API access.

## Secrets

Store these only in the deployment platform secrets manager:

- `DATABASE_URL`
- `REDIS_URL`
- `OPENROUTER_API_KEY`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `JWT_ACCESS_PRIVATE_KEY`
- `JWT_ACCESS_PUBLIC_KEY`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `TOKEN_HASH_PEPPER`
- `SMTP_URL`

Rotate JWT/token/storage/OpenRouter secrets with a staged deploy and session invalidation plan.

## Release order

1. Build images from CI using the service Dockerfiles.
2. Run database migrations as a single release job:
   - `pnpm --filter @wuzzify/brand-identity-api migration:run`
3. Deploy API and worker.
4. Deploy web.
5. Run smoke checks:
   - API `/v1/health/live`
   - API `/v1/health/ready`
   - Web `/`
   - Create/read workspace in staging
   - Queue a mocked generation job
   - Upload a small image to private storage
   - Compile tokens and generate an HTML brand-book export

## Migration policy

- Prefer expand/contract migrations.
- Do not deploy app code that requires a destructive migration before all old app instances are drained.
- Rollback strategy should usually be forward-fix after migrations have run.
- Keep migration logs as release artifacts.

## Storage and CDN

- Private uploads must not be publicly listable.
- Anonymous uploads must land in quarantine keys only.
- CDN must expose only immutable `public/...` keys written by authenticated publish action.
- Configure lifecycle cleanup for abandoned pending/quarantined uploads after the retention policy is finalized.

## Backup and recovery

- PostgreSQL: enable PITR, daily snapshot, restoration drill before launch.
- Object storage: versioning or immutable backups for private exports and public assets.
- Redis: AOF enabled; queue replay verified in staging.

Target placeholders before launch:

- RPO: define with product owner.
- RTO: define with product owner.

## Incident runbooks needed before launch

- Provider outage: OpenRouter down or image model unavailable.
- Queue backlog: workers stalled or Redis pressure.
- Compromised key/session: rotate secrets and revoke sessions.
- CDN abuse/takedown: unpublish asset and invalidate cache.
- Cost spike: lower budget, pause paid generation, inspect usage endpoint.
- Upload malware spike: disable anonymous uploads per project and quarantine review.

## Launch checklist

- [ ] `pnpm ci:verify` passing on hosted CI.
- [ ] Staging deploy from CI only.
- [ ] Migration rehearsal from empty DB and previous snapshot.
- [ ] Backup restore drill completed.
- [ ] CORS exact production origins configured.
- [ ] Secrets stored in secret manager only.
- [ ] Health checks wired to orchestration.
- [ ] Dashboards/alerts/on-call owner configured.
- [ ] Accessibility smoke for key frontend flows.
- [ ] Security scan exception register reviewed.
