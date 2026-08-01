import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type AssetUrlPurpose = 'upload' | 'download';

type AssetUrlTokenPayload = {
  assetId: string;
  objectKey: string;
  purpose: AssetUrlPurpose;
  expiresAt: string;
  variantId?: string;
};

@Injectable()
export class AssetUrlSigner {
  constructor(private readonly config: ConfigService) {}

  sign(payload: AssetUrlTokenPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = this.signature(encodedPayload);
    return `${encodedPayload}.${signature}`;
  }

  verify(token: string, purpose: AssetUrlPurpose): AssetUrlTokenPayload {
    const [encodedPayload, signature] = token.split('.');

    if (!encodedPayload || !signature) {
      throw new Error('Asset URL token is malformed.');
    }

    const expected = this.signature(encodedPayload);
    if (!safeEqual(signature, expected)) {
      throw new Error('Asset URL token signature is invalid.');
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as AssetUrlTokenPayload;
    if (payload.purpose !== purpose) {
      throw new Error('Asset URL token purpose is invalid.');
    }
    if (Date.parse(payload.expiresAt) <= Date.now()) {
      throw new Error('Asset URL token has expired.');
    }

    return payload;
  }

  private signature(encodedPayload: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_ACCESS_SECRET')).update(encodedPayload).digest('base64url');
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
