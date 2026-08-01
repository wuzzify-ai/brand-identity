import { Injectable } from '@nestjs/common';
import { DomainError } from '../common/domain-error';

@Injectable()
export class PasswordPolicyService {
  assertAcceptable(password: string): void {
    if (password.length < 12) {
      throw new DomainError('WEAK_PASSWORD', 'Password must be at least 12 characters.', 400);
    }

    if (password.length > 256) {
      throw new DomainError('WEAK_PASSWORD', 'Password is too long.', 400);
    }

    if (/^(.)\1+$/.test(password)) {
      throw new DomainError('WEAK_PASSWORD', 'Password is too easy to guess.', 400);
    }

    const commonPasswords = new Set([
      'passwordpassword',
      'password1234',
      'qwertyqwerty',
      '123456789012',
      'adminadminadmin'
    ]);

    if (commonPasswords.has(password.toLowerCase())) {
      throw new DomainError('WEAK_PASSWORD', 'Password is too common.', 400);
    }
  }
}
