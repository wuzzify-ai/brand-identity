# T028 — Asset upload and processing pipeline

**Status:** Implemented, pending Docker/S3 integration execution  
**Phase:** F — Visuals and assets  
**Depends on:** T002, T024, T026  
**Estimated size:** 2 days

## Objective

Implement private authenticated asset metadata, pre-signed uploads, verification, quarantine scanning, variants, and safe downloads.

## Scope

- `brand_assets` and `asset_variants` migration/entities.
- Upload URL/completion, asset read/update/archive, and signed-download endpoints.
- Processing worker for metadata, signature, malware, SVG, and image validation.

## Required implementation

1. Add migration with category/source/status/visibility, object uniqueness, checksum, and relation indexes.
2. Create pending asset with a server-generated key before issuing a short-lived upload URL.
3. On completion verify object ownership, declared/actual size, MIME signature, checksum, and allowed dimensions.
4. Quarantine until malware/content processing completes; sanitize or reject unsafe SVG.
5. Extract dimensions/duration and generate configured previews/variants.
6. Use private storage and short-lived read URLs; archive instead of deleting referenced assets.
7. Make upload completion idempotent and clean abandoned pending objects.

## Acceptance criteria

- [x] Caller cannot choose/overwrite another object key; keys are generated from workspace/version/asset IDs.
- [x] Wrong MIME, oversize, malware, and unsafe SVG never reach `AVAILABLE`.
- [x] Duplicate completion does not create duplicate assets/variants; worker writes variants idempotently.
- [x] Workspace roles and asset ownership are enforced by guarded API routes and scoped queries.
- [x] Download URLs expire and reveal no storage credentials.

## Required tests

- Added focused unit tests for signed asset URL tamper/expiry behavior.
- Added focused unit tests for MIME/signature validation.
- Added focused worker tests for dimension extraction, unsafe SVG rejection, and malware test signature rejection.
- Full S3-compatible integration tests remain pending until local Docker-backed storage is available.

## Implementation notes

- Added `brand_assets` and `asset_variants` database schema, enums, TypeORM entities, indexes, checksum constraints, and object-key uniqueness.
- Added authenticated upload creation, completion, list/get/update/archive, and signed-download endpoints.
- Added short-lived signed app upload/download URLs backed by a private object-storage service.
- Added completion verification for actual byte size, MIME signature, and checksum before quarantine.
- Added BullMQ asset-processing queue and worker that promotes safe assets to `AVAILABLE` or rejects unsafe content.
- Added original/preview variant records without requiring image-resizing dependencies yet.

## Out of scope

- Anonymous upload and CDN publishing.
