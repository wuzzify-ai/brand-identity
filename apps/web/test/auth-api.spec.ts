import { describe, expect, it } from 'vitest';
import { authTokenResponseSchema, genericAuthResponseSchema } from '../src/lib/auth-api';

describe('auth API schemas', () => {
  it('parses token and generic responses', () => {
    expect(authTokenResponseSchema.parse({ accessToken: 'token', expiresIn: 900 })).toEqual({
      accessToken: 'token',
      expiresIn: 900
    });
    expect(genericAuthResponseSchema.parse({ ok: true, message: 'Done' })).toEqual({
      ok: true,
      message: 'Done'
    });
  });
});
