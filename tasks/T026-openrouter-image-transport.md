# T026 — OpenRouter image transport and owned-storage ingestion

**Status:** Implemented, pending real OpenRouter/S3 integration execution  
**Phase:** F — Visuals and assets  
**Depends on:** T015, T017, T025  
**Estimated size:** 2 days

## Objective

Implement OpenRouter image-model discovery/generation and safely ingest every successful output into owned private storage.

## Scope

- `OpenRouterImageTransport` selected by `AiTransportFactory`.
- Image model capability discovery/cache.
- Text-to-image/reference-image requests, response parsing, and durable ingestion.

## Required implementation

1. Query/cache `/api/v1/images/models` and endpoint capabilities with a bounded TTL.
2. Validate requested resolution, aspect ratio, count, format, transparency, seed, and references against capabilities.
3. Generate with policy primary/fallback where supported and record actual model/provider/cost.
4. Treat ambiguous timeout outcomes carefully; do not blindly retry charged image generations.
5. Fetch/decode results with strict URL/size/type/time limits and SSRF protection.
6. Store in private object storage using server-generated keys and SHA-256; never keep provider URLs as canonical.
7. Create generation artifacts and preview metadata; delete partial/invalid objects safely.

## Acceptance criteria

- [x] Unsupported model parameters fail before a paid request.
- [x] Successful outputs remain available after provider URLs expire.
- [x] Network fetch cannot reach private/link-local endpoints.
- [x] Image count, dimensions, MIME, checksum, cost, and provenance are recorded.
- [x] Failed ingestion does not expose a broken artifact as successful.

## Required tests

- Contract tests for model discovery, capability mismatch, base64/URL output, timeout, SSRF targets, oversize content, wrong MIME, and storage failure.

## Implementation notes

- Added worker `OpenRouterImageTransport` with `/images/models` capability discovery and bounded in-memory TTL cache.
- Validates size, count, format, transparency, seed, and reference-image support before paid generation.
- Uses primary/fallback `models` ordering from policy-style inputs.
- Treats image generation as non-blind-retry work; no automatic retry loop is added for ambiguous charged outcomes.
- Added SSRF-safe image fetching with HTTP(S)-only URLs, DNS/IP private/link-local rejection, redirect blocking, MIME allowlist, timeout, and max byte limit.
- Supports both URL and base64 image outputs.
- Added private owned-storage ingestion with server-generated checksum keys and SHA-256.
- Provider URLs are never returned as canonical assets.
- Added request redaction for generated image prompts.

## Verification

- `pnpm --filter @wuzzify/brand-identity-worker typecheck`
- `pnpm --filter @wuzzify/brand-identity-worker lint`
- `pnpm --filter @wuzzify/brand-identity-worker test`

## Known limitation

- The current private storage adapter supports local `file://` storage for tests/development. Real S3-compatible object storage integration remains for T028.
- Real OpenRouter image generation was not executed during tests.

## Out of scope

- Public CDN publication and asset approval.
