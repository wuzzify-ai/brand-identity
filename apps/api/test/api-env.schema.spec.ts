import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateApiEnv } from '../src/config/api-env.schema';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const validEnv = {
  API_PUBLIC_URL: 'http://localhost:4000',
  WEB_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379/0',
  OPENROUTER_API_KEY: 'local-key',
  OPENROUTER_BRIEF_MODEL: 'anthropic/claude-sonnet-4',
  OPENROUTER_STRATEGY_MODEL: 'openai/gpt-4.1',
  OPENROUTER_VISUAL_MODEL: 'anthropic/claude-sonnet-4',
  OPENROUTER_ASSET_MODEL: 'openai/gpt-image-1',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'brand-identity-assets',
  S3_ACCESS_KEY_ID: 'access',
  S3_SECRET_ACCESS_KEY: 'secret',
  PUBLIC_ASSET_CDN_URL: 'http://localhost:9000/brand-identity-assets',
  ANONYMOUS_UPLOAD_MAX_BYTES: '10485760',
  ANONYMOUS_UPLOAD_GRANT_TTL_SECONDS: '900',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ISSUER: 'brand-identity-api',
  JWT_AUDIENCE: 'brand-identity-web',
  JWT_ACCESS_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  JWT_ACCESS_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  JWT_ACCESS_TTL_SECONDS: '900',
  REFRESH_TOKEN_TTL_DAYS: '30',
  ACCESS_TOKEN_TTL_SECONDS: '900',
  REFRESH_TOKEN_TTL_SECONDS: '2592000',
  EMAIL_FROM: 'brand-identity@localhost.test',
  SMTP_URL: 'smtp://localhost:1025',
  TOKEN_HASH_PEPPER: 't'.repeat(32),
  EMAIL_VERIFICATION_TTL_HOURS: '24',
  PASSWORD_RESET_TTL_MINUTES: '30'
};

describe('validateApiEnv', () => {
  it('returns parsed environment values', () => {
    expect(validateApiEnv(validEnv).API_PORT).toBe(4000);
  });

  it('fails on missing required values', () => {
    expect(() => validateApiEnv({})).toThrow('Invalid API environment');
  });

  it('fails on malformed URLs and byte limits', () => {
    expect(() =>
      validateApiEnv({
        ...validEnv,
        DATABASE_URL: 'not-a-url',
        ANONYMOUS_UPLOAD_MAX_BYTES: '0'
      })
    ).toThrow('Invalid API environment');
  });

  it('fails fast when access-token keys are not PKCS#8 and SPKI PEM values', () => {
    expect(() =>
      validateApiEnv({
        ...validEnv,
        JWT_ACCESS_PRIVATE_KEY: 'private-key-placeholder',
        JWT_ACCESS_PUBLIC_KEY: 'public-key-placeholder'
      })
    ).toThrow('JWT_ACCESS_PRIVATE_KEY must use -----BEGIN PRIVATE KEY----- format');
  });
});
