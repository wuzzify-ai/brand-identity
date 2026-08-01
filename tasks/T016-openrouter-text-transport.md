# T016 — OpenRouter structured-text transport

**Status:** Implemented  
**Phase:** D — AI platform  
**Depends on:** T002, T015  
**Estimated size:** 1–2 days

## Objective

Implement a production-safe OpenRouter chat transport supporting strict structured output, model fallbacks, routing preferences, metrics, and redaction.

## Scope

- `AiTransport` contract, `AiTransportFactory`, and `OpenRouterChatTransport`.
- HTTP timeouts, error taxonomy, usage extraction, and response validation handoff.
- No stage-specific prompt logic.

## Required implementation

1. Build requests with ordered `models`, JSON Schema `response_format`, stable hashed `user`, and `provider.require_parameters=true`.
2. Add optional data-collection/ZDR routing settings from policy.
3. Implement AbortController timeouts and bounded retries only for safe transport/rate-limit failures.
4. Parse actual model/provider/request ID, token counts, finish reason, and latency.
5. Redact authorization, cookies, raw tokens, and configured PII fields from logs.
6. Map upstream failures into stable retryable/non-retryable domain errors.

## Acceptance criteria

- [x] API key is server-only and never logged.
- [x] Unsupported structured-output endpoints are excluded.
- [x] Fallback order is passed exactly from policy.
- [x] Timeout/rate-limit/schema/content errors remain distinguishable.
- [x] A mocked valid response produces a typed normalized result.

## Required tests

- HTTP contract tests for success, fallback, 429, timeout, malformed JSON, provider error, and redaction.

## Implementation notes

- Added `AiTransport` contract plus `AiTransportFactory` following the backend factory pattern.
- Added `OpenRouterChatTransport` for `/chat/completions` structured JSON Schema calls.
- Requests include ordered `models`, primary `model`, strict `response_format.json_schema`, hashed `user`, provider preferences, and `provider.require_parameters=true`.
- Transport handles AbortController timeouts, bounded retries, usage/model/provider/request-id parsing, malformed upstream responses, content-filter responses, and stable domain-error mapping.
- Added `redactForAiLogs` to scrub authorization/cookie/token/secret fields plus configured PII keys.

## Verification

- `pnpm --filter @wuzzify/brand-identity-api typecheck`
- `pnpm --filter @wuzzify/brand-identity-api lint`
- `pnpm --filter @wuzzify/brand-identity-api test -- openrouter-chat-transport.spec.ts ai-policy-support.spec.ts`

## Out of scope

- Image generation (T026) and durable generation jobs (T017).
