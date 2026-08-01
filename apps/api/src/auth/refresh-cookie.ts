import type { Response } from 'express';

export const refreshCookieName = 'brand_identity_refresh';

type RefreshCookieOptions = {
  secure?: boolean;
};

export function shouldSecureRefreshCookie(nodeEnv: string | undefined, apiPublicUrl: string | undefined): boolean {
  if (nodeEnv === 'production') {
    return true;
  }

  if (!apiPublicUrl) {
    return false;
  }

  try {
    return new URL(apiPublicUrl).protocol === 'https:';
  } catch {
    return false;
  }
}

export function setRefreshCookie(
  response: Response,
  rawRefreshToken: string,
  maxAgeMs: number,
  options: RefreshCookieOptions = {}
): void {
  response.cookie(refreshCookieName, rawRefreshToken, {
    httpOnly: true,
    secure: options.secure ?? true,
    sameSite: 'lax',
    path: '/v1/auth',
    maxAge: maxAgeMs
  });
}

export function clearRefreshCookie(response: Response, options: RefreshCookieOptions = {}): void {
  response.clearCookie(refreshCookieName, {
    httpOnly: true,
    secure: options.secure ?? true,
    sameSite: 'lax',
    path: '/v1/auth'
  });
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) {
    return null;
  }

  const parts = header.split(';').map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
