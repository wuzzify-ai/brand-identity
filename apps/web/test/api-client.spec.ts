import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, apiFetch, normalizeApiError } from '../src/lib/api-client';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('normalizeApiError', () => {
  it('maps API envelopes', () => {
    expect(
      normalizeApiError({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed.',
          requestId: 'req_123'
        }
      })
    ).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed.',
      requestId: 'req_123',
      details: undefined
    });
  });

  it('maps client errors', () => {
    expect(
      normalizeApiError(
        new ApiClientError({
          code: 'HTTP_500',
          message: 'Server failed.',
          status: 500
        })
      )
    ).toEqual({
      code: 'HTTP_500',
      message: 'Server failed.',
      status: 500
    });
  });

  it('refreshes an expired bearer token and retries the request once', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/v1');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'HTTP_401', message: 'Authentication is required.' } }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'fresh-token', expiresIn: 900 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await expect(apiFetch<{ ok: boolean }>('/workspaces', { headers: { Authorization: 'Bearer expired-token' } })).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(expect.objectContaining({
      headers: expect.any(Headers)
    }));
    const retryHeaders = fetchMock.mock.calls[2]?.[1]?.headers as Headers;
    expect(retryHeaders.get('authorization')).toBe('Bearer fresh-token');
  });
});
