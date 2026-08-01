# T038 — Security and tenant-isolation hardening

**Status:** Partially implemented, pending full security suite/scans  
**Phase:** H — Platform hardening  
**Depends on:** All feature/API tasks, T036, T037  
**Estimated size:** 2 days

## Objective

Perform and fix a systematic security review across authentication, authorization, AI, uploads, rendering, CDN, and tenant boundaries.

## Scope

- Threat model and misuse cases.
- Repository/controller authorization review.
- CSRF/CORS/CSP/SSRF/XSS/SVG/PDF/upload/prompt-injection controls.
- Secret/PII retention and deletion.

## Required implementation

1. Document assets, trust boundaries, attacker types, entry points, and mitigations.
2. Verify every protected endpoint scopes by live membership and every IDOR attempt returns non-leaking failure.
3. Review JWT/cookie/refresh rotation, rate limiting, email enumeration, and security headers.
4. Verify URL fetch SSRF blocks DNS rebinding/private ranges and renderers have no network/host access.
5. Fuzz upload MIME/signature/SVG/archive boundaries and enforce decompression/pixel limits.
6. Confirm anonymous grant quotas, quarantine, moderation, cleanup, and immutable CDN paths.
7. Verify AI prompts treat uploaded/user content as data and logs/storage follow retention/redaction.
8. Add dependency/container secret scanning and address high/critical results.

## Acceptance criteria

- [ ] Automated tenant matrix covering every resource type remains pending.
- [ ] Dependency/container high/critical scan exception register remains pending.
- [x] Browser security headers pass tests.
- [x] Threat boundaries and known retention/deletion gaps are documented.

## Required tests

- Added API security-header unit test.
- API typecheck/lint/test pass.
- Dedicated abuse/IDOR/CSRF/SSRF/XSS/upload/prompt-injection/rate-limit suite and dependency scans remain pending.

## Implementation notes

- Added security headers middleware with CSP, frame denial, nosniff, referrer policy, and permissions policy.
- Added `SECURITY_THREAT_MODEL.md` documenting assets, trust boundaries, attacker types, controls, and pending hardening.

## Out of scope

- Formal third-party penetration test execution, though the system should be ready for one.
