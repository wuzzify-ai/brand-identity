# T032 — Deterministic design-token compiler

**Status:** Implemented, pending DB integration/concurrency execution  
**Phase:** G — Final package and activation  
**Depends on:** T024, T030  
**Estimated size:** 1–2 days

## Objective

Compile validated, versioned design tokens from the selected visual direction and approved assets without using unconstrained AI output.

## Scope

- `design_token_sets` migration/entity.
- Canonical DTCG-style JSON compiler and JSON/CSS/SCSS/Tailwind exporters.
- Validation, deterministic serialization, checksums, and revisioning.

## Required implementation

1. Add migration with current-per-format partial index and revision constraints.
2. Define canonical token schema/types in `packages/design-tokens`.
3. Read selected direction; normalize safe token names and map colors/fonts/spacing/shape/motion where present.
4. Validate duplicates, references, colors, font roles/weights, and required fallback stacks.
5. Serialize deterministically and calculate SHA-256.
6. In one transaction mark previous current format false and store the next revision.
7. Derive other formats only from canonical JSON; escape CSS identifiers/values safely.

## Acceptance criteria

- [x] Same inputs produce byte-identical canonical JSON/checksum.
- [x] Invalid/missing selections fail with actionable errors and no partial current set.
- [x] Exactly one current set exists per version/format via partial unique index and transaction logic.
- [x] CSS/SCSS/Tailwind outputs sanitize identifiers/values to avoid arbitrary injected code.

## Required tests

- Added package tests for deterministic ordering/checksum and CSS-like injection escaping.
- Design-token package build/typecheck/lint/test pass.
- API typecheck/lint/test pass.
- Concurrent revision integration tests remain pending Docker/PostgreSQL execution.

## Implementation notes

- Replaced the design-token package stub with a deterministic DTCG-style compiler and JSON/CSS/SCSS/Tailwind exporters.
- Added `design_token_sets` schema with current-per-format and revision uniqueness constraints.
- Added API compile/list/get-current endpoints.
- Compiler reads the selected visual direction and selected logo concept/assets, serializes deterministically, checksums content, and stores all formats in one transaction.

## Out of scope

- AI narrative and PDF rendering.
