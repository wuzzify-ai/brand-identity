import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../src/common/domain-error';
import { OpenRouterChatTransport } from '../src/ai/transports/openrouter-chat.transport';
import { redactForAiLogs } from '../src/ai/transports/openrouter-redaction';
import type { AiStructuredTextRequest } from '../src/ai/transports/ai-transport.types';

const baseRequest: AiStructuredTextRequest = {
  task: 'BRIEF_EXTRACT',
  schemaName: 'brief_extract',
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: { industry: { type: 'string' } },
    required: ['industry']
  },
  messages: [
    { role: 'system', content: 'Return JSON.' },
    { role: 'user', content: 'Coffee shop in Cairo.' }
  ],
  models: ['openai/gpt-5.6-luna', 'openai/gpt-5.6-terra'],
  providerPreferences: { data_collection: 'deny', zdr: true },
  requestParameters: { temperature: 0.2 },
  userKey: 'workspace-123:user-456',
  maxAttempts: 1,
  timeoutMs: 1_000
};

function makeTransport(fetcher: typeof fetch) {
  return new OpenRouterChatTransport(
    new ConfigService({
      OPENROUTER_BASE_URL: 'https://openrouter.test/api/v1',
      OPENROUTER_API_KEY: 'super-secret-key',
      API_PUBLIC_URL: 'https://api.example.test'
    }),
    fetcher
  );
}

function response(body: unknown, init?: ResponseInit) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'x-request-id': 'req_header_123' },
      ...init
    })
  );
}

describe('OpenRouterChatTransport', () => {
  it('builds a structured-output request and normalizes a valid response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      await response({
        id: 'chatcmpl_123',
        model: 'openai/gpt-5.6-luna',
        provider: 'openai',
        choices: [
          {
            finish_reason: 'stop',
            native_finish_reason: 'stop',
            message: { content: '{"industry":"Hospitality"}' }
          }
        ],
        usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 }
      })
    );

    const result = await makeTransport(fetcher).generateStructuredText<{ industry: string }>(baseRequest);
    const [, init] = fetcher.mock.calls[0]!;
    const body = JSON.parse(String(init?.body));

    expect(body.models).toEqual(baseRequest.models);
    expect(body.model).toBe(baseRequest.models[0]);
    expect(body.user).toMatch(/^u_[a-f0-9]{32}$/);
    expect(body.user).not.toContain('workspace-123');
    expect(body.provider).toEqual({ data_collection: 'deny', zdr: true, require_parameters: true });
    expect(body.response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'brief_extract', strict: true, schema: baseRequest.outputSchema }
    });
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer super-secret-key');
    expect(result.data.industry).toBe('Hospitality');
    expect(result.usage.totalTokens).toBe(18);
    expect(result.requestId).toBe('req_header_123');
  });

  it('maps 429 responses to retryable rate-limit errors', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(await response({ error: { message: 'Too many requests' } }, { status: 429 }));

    await expect(makeTransport(fetcher).generateStructuredText(baseRequest)).rejects.toMatchObject({
      code: 'AI_RATE_LIMIT',
      statusCode: 429,
      details: { retryable: true }
    });
  });

  it('aborts requests that exceed the configured timeout', async () => {
    const fetcher = vi.fn<typeof fetch>((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const abortError = new Error('aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    });

    await expect(
      makeTransport(fetcher).generateStructuredText({ ...baseRequest, timeoutMs: 1 })
    ).rejects.toMatchObject({
      code: 'AI_TIMEOUT',
      statusCode: 504,
      details: { retryable: true }
    });
  });

  it('keeps malformed assistant JSON distinct from provider transport failures', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      await response({
        model: 'openai/gpt-5.6-luna',
        choices: [{ finish_reason: 'stop', message: { content: 'not json' } }]
      })
    );

    await expect(makeTransport(fetcher).generateStructuredText(baseRequest)).rejects.toMatchObject({
      code: 'AI_RESPONSE_JSON_INVALID',
      statusCode: 502,
      details: { retryable: false }
    });
  });

  it('maps provider 5xx responses to retryable provider errors', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(await response({ error: { message: 'Provider unavailable' } }, { status: 503 }));

    await expect(makeTransport(fetcher).generateStructuredText(baseRequest)).rejects.toMatchObject({
      code: 'AI_PROVIDER_ERROR',
      statusCode: 502,
      details: { retryable: true }
    });
  });

  it('redacts server secrets and configured PII fields for logs', () => {
    expect(
      redactForAiLogs(
        {
          headers: { Authorization: 'Bearer super-secret-key', Cookie: 'sid=123' },
          body: { email: 'founder@example.test', nested: { refresh_token: 'raw-refresh-token' } }
        },
        ['email']
      )
    ).toEqual({
      headers: { Authorization: '[REDACTED]', Cookie: '[REDACTED]' },
      body: { email: '[REDACTED]', nested: { refresh_token: '[REDACTED]' } }
    });
  });

  it('exposes missing model input as a caller error', async () => {
    const fetcher = vi.fn<typeof fetch>();

    await expect(makeTransport(fetcher).generateStructuredText({ ...baseRequest, models: [] })).rejects.toBeInstanceOf(
      DomainError
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
