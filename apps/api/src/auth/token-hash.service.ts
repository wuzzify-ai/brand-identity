import { createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TokenHashService {
  constructor(private readonly config: ConfigService) {}

  generateRawToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hash(rawToken: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('TOKEN_HASH_PEPPER'))
      .update(rawToken)
      .digest('hex');
  }
}
