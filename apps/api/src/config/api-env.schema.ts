import { createPrivateKey, createPublicKey } from 'node:crypto';
import { z } from 'zod';

function pemSchema(
  label: string,
  beginMarker: string,
  endMarker: string,
  parse: (pem: string) => unknown
) {
  return z.string().min(1).superRefine((value, context) => {
    const pem = value.replace(/\\n/g, '\n');

    if (!pem.startsWith(beginMarker) || !pem.trimEnd().endsWith(endMarker)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} must use ${beginMarker} format`
      });
      return;
    }

    try {
      parse(pem);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} is not a valid PEM key`
      });
    }
  });
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_PUBLIC_URL: z.string().url(),
  WEB_ORIGIN: z.string().min(1),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_BRIEF_MODEL: z.string().min(1),
  OPENROUTER_STRATEGY_MODEL: z.string().min(1),
  OPENROUTER_VISUAL_MODEL: z.string().min(1),
  OPENROUTER_ASSET_MODEL: z.string().min(1),
  AI_WORKSPACE_MONTHLY_BUDGET_MICRO_USD: z.coerce.number().int().min(0).default(100_000_000),
  AI_GENERATION_PRECHARGE_MICRO_USD: z.coerce.number().int().min(0).default(1_000_000),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  PUBLIC_ASSET_CDN_URL: z.string().url(),
  AUTHENTICATED_UPLOAD_MAX_BYTES: z.coerce.number().int().min(1).max(100 * 1024 * 1024).default(25 * 1024 * 1024),
  ASSET_UPLOAD_GRANT_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  ASSET_DOWNLOAD_GRANT_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
  ANONYMOUS_UPLOAD_MAX_BYTES: z.coerce.number().int().min(1).max(100 * 1024 * 1024),
  ANONYMOUS_UPLOAD_GRANT_TTL_SECONDS: z.coerce.number().int().min(60).max(3600),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  JWT_ACCESS_PRIVATE_KEY: pemSchema(
    'JWT_ACCESS_PRIVATE_KEY',
    '-----BEGIN PRIVATE KEY-----',
    '-----END PRIVATE KEY-----',
    createPrivateKey
  ),
  JWT_ACCESS_PUBLIC_KEY: pemSchema(
    'JWT_ACCESS_PUBLIC_KEY',
    '-----BEGIN PUBLIC KEY-----',
    '-----END PUBLIC KEY-----',
    createPublicKey
  ),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(86400),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3600).max(60 * 60 * 24 * 90),
  EMAIL_FROM: z.string().email(),
  SMTP_URL: z.string().url(),
  TOKEN_HASH_PEPPER: z.string().min(32),
  EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30)
});

export type ApiEnv = z.infer<typeof envSchema>;

export function validateApiEnv(config: Record<string, unknown>): ApiEnv {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid API environment: ${issues}`);
  }

  return result.data;
}
