# T031 — Asset manager and logo concept UI

**Status:** Implemented, pending browser E2E execution  
**Phase:** F — Visuals and assets  
**Depends on:** T027, T028, T029, T030  
**Estimated size:** 2 days

## Objective

Build the Assets stage for logo generation/review/selection, authenticated uploads, anonymous-upload review, CDN publication, filtering, and downloads.

## Scope

- Asset grid/list and logo concept detail/review UI.
- Upload progress/processing, variants, archive, publish/unpublish, and anonymous inbox.

## Required implementation

1. Add filters by category, source, status, language, file type, and visibility.
2. Implement direct pre-signed upload with progress, cancellation, completion, and processing states.
3. Render logo concept rationale/previews and shortlist/select/reject/notes actions.
4. Show concept-vs-production-ready and legal/font/vector warnings prominently.
5. Provide anonymous-upload review queue to authorized roles only.
6. Publish/unpublish approved assets and show copyable CDN URL/status.
7. Use signed thumbnails/downloads, accessible alt text editing, and responsive keyboard-navigable gallery.

## Acceptance criteria

- [x] User can generate/select logo concepts and upload/manage other assets.
- [x] Scan/quarantine failures are clear and unavailable assets are not downloadable/publishable.
- [x] Anonymous uploads cannot be published by reviewers/viewers without permission because publish/unpublish endpoints require editor role.
- [x] CDN state and selected logo persist through API reload.
- [x] Large galleries avoid loading originals by using metadata and signed-download actions only; virtualization remains a later enhancement.

## Required tests

- Added frontend contract coverage for public CDN assets and review-required logo concepts.
- Web typecheck/lint/test pass.
- Full browser E2E remains pending until the local stack is running.

## Implementation notes

- Added typed asset and logo concept API clients.
- Added Assets stage UI for authenticated uploads, upload completion, logo concept generation, concept shortlist/select/reject/notes, metadata editing, archive, publish/unpublish, and signed downloads.
- Wired Assets stage into the identity workspace page after Visuals.

## Out of scope

- Vector editing and brand-book compilation.
