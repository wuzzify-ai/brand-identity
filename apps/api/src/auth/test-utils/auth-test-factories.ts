import { createHash, randomBytes } from 'node:crypto';

export function randomEmail(prefix = 'user'): string {
  return `${prefix}.${randomBytes(6).toString('hex')}@example.test`;
}

export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token = randomToken()): string {
  return createHash('sha256').update(token).digest('hex');
}

export function fakePasswordHash(): string {
  return `$argon2id$v=19$m=65536,t=3,p=4$${randomBytes(16).toString('base64url')}$${randomBytes(32).toString('base64url')}`;
}
