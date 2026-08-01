# T004 — Next.js web foundation

**Status:** Implemented  
**Phase:** A — Foundation  
**Depends on:** T001, T002  
**Estimated size:** 1 day

## Objective

Create the web application shell, design primitives, typed API client, and server-state foundation.

## Scope

- App Router layouts for public/authenticated areas.
- TanStack Query provider, React Hook Form/Zod conventions, API error mapping, and basic responsive design tokens.
- Accessibility and RTL-ready document configuration.

## Required implementation

1. Add public and authenticated route groups with placeholder pages.
2. Implement a typed fetch client with base URL, request ID, JSON parsing, and normalized errors.
3. Add query provider/devtools only where appropriate.
4. Add reusable form, button, dialog, toast, skeleton, empty-state, and error-state primitives.
5. Support `dir="rtl"` from locale and prevent server/client hydration mismatches.
6. Configure image origins without allowing arbitrary hosts.

## Acceptance criteria

- [ ] Public and protected layouts render responsively.
- [ ] API errors display actionable messages without leaking internals.
- [ ] Keyboard navigation and focus styles work on primitives.
- [ ] A sample LTR and RTL page passes basic accessibility checks.

## Required tests

- Component tests for error mapping, forms, dialog focus, and RTL rendering.
- Production web build and route smoke test.

## Out of scope

- Real authentication state and brand workflow screens.

## Implementation notes

- Added Next.js App Router shell, public/workspace route groups, RTL preview, typed API client, query provider, and reusable UI primitives.
- Web lint, typecheck, tests, and production build pass.
- Local web app was started and confirmed with a `200` response from `http://localhost:3000`.
