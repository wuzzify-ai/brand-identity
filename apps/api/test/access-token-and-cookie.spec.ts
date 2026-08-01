import { generateKeyPairSync } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { AccessTokenService } from '../src/auth/access-token.service';
import {
  clearRefreshCookie,
  readCookie,
  refreshCookieName,
  setRefreshCookie,
  shouldSecureRefreshCookie
} from '../src/auth/refresh-cookie';

function createJwtConfig() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

  return new ConfigService({
    JWT_ISSUER: 'brand-identity-api',
    JWT_AUDIENCE: 'brand-identity-web',
    JWT_ACCESS_TTL_SECONDS: 900,
    JWT_ACCESS_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    JWT_ACCESS_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'pem' }).toString()
  });
}

describe('AccessTokenService', () => {
  it('signs and verifies asymmetric access tokens', async () => {
    const service = new AccessTokenService(createJwtConfig());

    const token = await service.sign({
      sub: '6f063f66-c8ae-4da5-8099-a6716d8652da',
      sid: '0ff4a152-0663-4d95-b54f-9d6c2c3b3d7a'
    });

    await expect(service.verify(token)).resolves.toEqual({
      sub: '6f063f66-c8ae-4da5-8099-a6716d8652da',
      sid: '0ff4a152-0663-4d95-b54f-9d6c2c3b3d7a'
    });
  });
});

describe('refresh cookie helpers', () => {
  it('sets and clears secure refresh cookies by default', () => {
    const response = {
      cookie: vi.fn(),
      clearCookie: vi.fn()
    };

    setRefreshCookie(response as never, 'raw-refresh', 1000);
    clearRefreshCookie(response as never);

    expect(response.cookie).toHaveBeenCalledWith(
      refreshCookieName,
      'raw-refresh',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax'
      })
    );
    expect(response.clearCookie).toHaveBeenCalledWith(
      refreshCookieName,
      expect.objectContaining({
        httpOnly: true,
        secure: true
      })
    );
  });

  it('supports non-secure refresh cookies for local HTTP development', () => {
    const response = {
      cookie: vi.fn(),
      clearCookie: vi.fn()
    };

    setRefreshCookie(response as never, 'raw-refresh', 1000, { secure: false });
    clearRefreshCookie(response as never, { secure: false });

    expect(response.cookie).toHaveBeenCalledWith(
      refreshCookieName,
      'raw-refresh',
      expect.objectContaining({ secure: false })
    );
    expect(response.clearCookie).toHaveBeenCalledWith(
      refreshCookieName,
      expect.objectContaining({ secure: false })
    );
  });

  it('keeps production refresh cookies secure and allows localhost development', () => {
    expect(shouldSecureRefreshCookie('production', 'http://localhost:4000')).toBe(true);
    expect(shouldSecureRefreshCookie('development', 'http://localhost:4000')).toBe(false);
    expect(shouldSecureRefreshCookie('development', 'https://api.example.test')).toBe(true);
  });

  it('reads a named cookie from a cookie header', () => {
    expect(readCookie('a=1; brand_identity_refresh=raw%20token; b=2', refreshCookieName)).toBe('raw token');
    expect(readCookie('a=1', refreshCookieName)).toBeNull();
  });
});
