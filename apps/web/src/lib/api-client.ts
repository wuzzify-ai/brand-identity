import { apiErrorSchema, requestIdHeader } from '@wuzzify/brand-contracts';
import { getWebEnv } from './env';

export type NormalizedApiError = {
  code: string;
  message: string;
  requestId?: string | undefined;
  status?: number | undefined;
  details?: unknown;
};

export class ApiClientError extends Error {
  constructor(public readonly payload: NormalizedApiError) {
    super(payload.message);
  }
}

let inFlightRefresh: Promise<string> | null = null;

function createRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function refreshAccessToken(): Promise<string> {
  if (!inFlightRefresh) {
    const { NEXT_PUBLIC_API_BASE_URL } = getWebEnv();
    inFlightRefresh = fetch(`${NEXT_PUBLIC_API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', [requestIdHeader]: createRequestId() },
      credentials: 'include'
    })
      .then(async (response) => {
        const text = await response.text();
        const json = text ? (JSON.parse(text) as unknown) : null;
        if (!response.ok || !json || typeof json !== 'object' || typeof (json as { accessToken?: unknown }).accessToken !== 'string') {
          throw new ApiClientError({
            ...normalizeApiError(json),
            status: response.status,
            requestId: response.headers.get(requestIdHeader) ?? undefined
          });
        }

        const token = (json as { accessToken: string }).accessToken;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('brand_identity_access_token_refreshed', { detail: token }));
        }
        return token;
      })
      .finally(() => {
        inFlightRefresh = null;
      });
  }

  return inFlightRefresh;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { NEXT_PUBLIC_API_BASE_URL } = getWebEnv();
  const requestId = createRequestId();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');
  headers.set(requestIdHeader, requestId);

  const response = await fetch(`${NEXT_PUBLIC_API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include'
  });

  if (response.status === 401 && headers.get('authorization') && path !== '/auth/refresh') {
    try {
      const accessToken = await refreshAccessToken();
      headers.set('authorization', `Bearer ${accessToken}`);
      headers.set(requestIdHeader, createRequestId());
      return apiFetch<T>(path, { ...init, headers });
    } catch {
      // Return the original 401 below so callers can present the sign-in flow.
    }
  }

  const text = await response.text();
  const json = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    throw new ApiClientError({
      ...normalizeApiError(json),
      status: response.status,
      requestId: response.headers.get(requestIdHeader) ?? requestId
    });
  }

  return json as T;
}

export function normalizeApiError(error: unknown): NormalizedApiError {
  if (error instanceof ApiClientError) {
    return error.payload;
  }

  const parsed = apiErrorSchema.safeParse(error);

  if (parsed.success) {
    return {
      code: parsed.data.error.code,
      message: parsed.data.error.message,
      requestId: parsed.data.error.requestId,
      details: parsed.data.error.details
    };
  }

  if (error instanceof Error) {
    return {
      code: 'CLIENT_ERROR',
      message: error.message
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'Something went wrong.'
  };
}
