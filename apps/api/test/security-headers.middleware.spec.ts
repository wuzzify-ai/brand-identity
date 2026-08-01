import { describe, expect, it } from 'vitest';
import { SecurityHeadersMiddleware } from '../src/common/security-headers.middleware';

describe('SecurityHeadersMiddleware', () => {
  it('sets browser hardening headers', () => {
    const headers = new Map<string, string>();
    const middleware = new SecurityHeadersMiddleware();

    middleware.use(
      {} as never,
      {
        setHeader: (key: string, value: string) => headers.set(key, value)
      } as never,
      () => undefined
    );

    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Content-Security-Policy')).toContain("default-src 'none'");
  });
});
