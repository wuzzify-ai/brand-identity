import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../src/common/domain-error';
import { AuthEmailService } from '../src/auth/email/auth-email.service';
import { EmailDeliveryService, type TransactionalEmail } from '../src/auth/email/email-delivery.service';
import { PasswordPolicyService } from '../src/auth/password-policy.service';
import { TokenHashService } from '../src/auth/token-hash.service';

class CapturingDelivery extends EmailDeliveryService {
  readonly sent: TransactionalEmail[] = [];

  async send(email: TransactionalEmail): Promise<void> {
    this.sent.push(email);
  }
}

describe('PasswordPolicyService', () => {
  it('accepts long memorable passwords and rejects brittle weak cases', () => {
    const policy = new PasswordPolicyService();

    expect(() => policy.assertAcceptable('four words can travel far')).not.toThrow();
    expect(() => policy.assertAcceptable('short')).toThrow(DomainError);
    expect(() => policy.assertAcceptable('aaaaaaaaaaaa')).toThrow(DomainError);
    expect(() => policy.assertAcceptable('passwordpassword')).toThrow(DomainError);
  });
});

describe('TokenHashService', () => {
  it('hashes tokens deterministically without returning raw values', () => {
    const service = new TokenHashService(
      new ConfigService({
        TOKEN_HASH_PEPPER: 'pepper-value-with-at-least-32-chars'
      })
    );

    const rawToken = service.generateRawToken();
    const hash = service.hash(rawToken);

    expect(rawToken).not.toBe(hash);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(service.hash(rawToken)).toBe(hash);
  });
});

describe('AuthEmailService', () => {
  it('builds a verification email using the raw token only in the outbound message', async () => {
    const delivery = new CapturingDelivery();
    const service = new AuthEmailService(new ConfigService({ WEB_ORIGIN: 'https://app.example.test' }), delivery);

    await service.sendVerificationEmail('user@example.test', 'raw-token');

    expect(delivery.sent).toHaveLength(1);
    expect(delivery.sent[0]?.to).toBe('user@example.test');
    expect(delivery.sent[0]?.text).toContain('https://app.example.test/verify-email?token=raw-token');
  });

  it('builds a password reset email with the reset token', async () => {
    const delivery = new CapturingDelivery();
    const service = new AuthEmailService(new ConfigService({ WEB_ORIGIN: 'https://app.example.test' }), delivery);

    await service.sendPasswordResetEmail('user@example.test', 'reset-token');

    expect(delivery.sent[0]?.subject).toContain('Reset');
    expect(delivery.sent[0]?.text).toContain('https://app.example.test/reset-password?token=reset-token');
  });
});
