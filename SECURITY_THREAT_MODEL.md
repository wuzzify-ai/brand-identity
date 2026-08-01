# Brand Identity v3 Security Threat Model

## Assets

- User accounts, refresh tokens, access tokens, sessions, and workspace memberships.
- Brand identity content: briefs, strategies, visual directions, logo concepts, private/public assets, design tokens, brand books, approvals, audit logs.
- Provider secrets: OpenRouter API key, JWT keys, SMTP credentials, S3 credentials, token pepper.
- Private object storage and public CDN objects.

## Trust boundaries

- Browser to API over CORS-authenticated HTTP.
- API to PostgreSQL/Redis/object storage/OpenRouter/SMTP.
- Worker to Redis/PostgreSQL/OpenRouter/object storage.
- Anonymous public upload grant endpoints to private quarantine storage.
- Public CDN list/download boundary, which must expose only approved immutable public objects.

## Attacker types

- Anonymous internet user attempting upload abuse, replay, public listing scraping, and token guessing.
- Authenticated workspace viewer/reviewer attempting editor/owner mutations.
- Malicious workspace editor attempting IDOR against another workspace/project/version.
- Malicious uploaded content attempting SVG/script/PDF/image parser abuse.
- Prompt-injection content embedded in user uploads or business descriptions.
- Infrastructure attacker with access to logs trying to recover tokens/secrets/prompts.

## Implemented controls

- Workspace membership guard and role metadata on protected controllers.
- Scoped SQL queries include workspace/project/version IDs for user-facing resources.
- Short-lived signed upload/download URLs; anonymous callers never receive bucket credentials.
- Anonymous grants use hashed secrets, expiry, quotas, quarantine, and one-upload protection.
- Uploaded content remains private until scan/processing and explicit publication.
- Safe image fetch blocks private/local IP ranges for provider-returned URLs.
- SVG script/remote-reference markers and EICAR malware-test signatures are rejected by worker processing.
- Audit redaction removes password/token/secret/hash/prompt-like fields.
- API browser security headers: CSP, frame denial, nosniff, referrer policy, and permissions policy.
- AI budget guard blocks new paid generation while leaving manual edit APIs available.

## Known pending hardening

- Full automated IDOR matrix across every resource/controller.
- CSRF-specific test matrix for cookie-authenticated endpoints.
- PDF/HTML renderer sandbox with external network disabled.
- Outbox publisher retry/dead-letter implementation.
- Active-version immutability guards across all mutation services.
- Complete asset cleanup/retention scheduler.
- Dependency/container scans and documented exception register.

## Review checklist before production

1. Run DB-backed role/tenant integration tests for every route.
2. Run upload fuzz tests for MIME confusion, decompression bombs, unsafe SVG, oversize files, and replay.
3. Verify cookies are Secure/HttpOnly/SameSite in the deployed environment.
4. Verify CORS origins are exact production origins only.
5. Run dependency and container image scans; document unresolved highs/criticals.
6. Verify CDN origin cannot be written anonymously and public listing includes only approved `PUBLIC_CDN` assets.
7. Verify logs and artifacts do not contain raw provider prompts, auth secrets, tokens, or upload grants.
