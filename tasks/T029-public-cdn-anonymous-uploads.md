# T029 — Public CDN and constrained anonymous uploads

**Status:** Implemented, pending Docker/S3/CDN integration execution  
**Phase:** F — Visuals and assets  
**Depends on:** T010, T028  
**Estimated size:** 2 days

## Objective

Publish owner-approved assets to immutable public CDN paths and accept unauthenticated uploads only through safe single-use quarantine grants.

## Scope

- `anonymous_upload_grants` migration/entity and project public-upload settings.
- Public list, grant, complete, status, authenticated publish, and unpublish endpoints.
- CAPTCHA/bot checks, quotas, moderation/scanning, CDN invalidation, cleanup.

## Required implementation

1. Add project public slug/policy and asset visibility/CDN fields plus grant table migration.
2. Issue 5–15 minute grant after bot challenge and IP/project/global rate/byte checks.
3. Hash the grant secret; generate a unique quarantine object key; allow one PUT only.
4. Complete using grant secret, object verification, idempotency, and processing pipeline from T028.
5. Reveal only limited scan status to the grant holder; never reveal private project data.
6. Require authenticated editor/owner approval before publishing to immutable CDN path.
7. Unpublish from listing/origin and invalidate cache; preserve audit/history.
8. Expire/revoke grants and remove abandoned/quarantined data according to retention.

## Acceptance criteria

- [x] No anonymous caller gets bucket credentials, list, overwrite, delete, or public-origin write permission.
- [x] Reused/expired/revoked grants fail through hashed secret and grant-status checks.
- [x] Anonymous content is private until scanned and explicitly approved.
- [x] Public listing returns only published `PUBLIC_CDN` assets.
- [x] Abuse quotas are enforced in API logic and covered by support tests; cleanup jobs remain pending integration scheduling.

## Required tests

- Added focused tests for anonymous signed-upload URL safety and purpose binding.
- Existing T028 tests cover upload token tamper/expiry, unsafe MIME, unsafe SVG, and malware signature rejection.
- Full cross-project, replay, CAPTCHA/rate-limit, publish/unpublish, and CDN-path integration tests remain pending Docker/S3/CDN execution.

## Implementation notes

- Added `anonymous_upload_grants` schema/entity with hashed secrets, IP hash, expiry, and lifecycle state.
- Added public CDN publication fields to `brand_assets`.
- Added unauthenticated public asset list, anonymous grant, anonymous completion, and anonymous status endpoints.
- Added authenticated publish/unpublish endpoints requiring workspace editor role.
- Added one-PUT upload protection by marking received upload bytes before completion.
- CDN publication copies the private object to an immutable public key and stores the public CDN URL.

## Out of scope

- A fully open writable storage bucket; that design is intentionally prohibited.
