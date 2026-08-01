import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { AssetUrlSigner } from '../src/assets/storage/asset-url-signer.service';

describe('AssetUrlSigner', () => {
  const signer = new AssetUrlSigner(
    new ConfigService({
      JWT_ACCESS_SECRET: 'asset-test-secret-that-is-long-enough'
    })
  );

  it('verifies signed upload grants and rejects tampering', () => {
    const token = signer.sign({
      assetId: 'asset-id',
      objectKey: 'private/workspaces/ws/versions/ver/asset/file.png',
      purpose: 'upload',
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });

    expect(signer.verify(token, 'upload').objectKey).toContain('private/workspaces');
    expect(() => signer.verify(`${token.slice(0, -1)}x`, 'upload')).toThrow(/signature/i);
  });

  it('rejects expired grants', () => {
    const token = signer.sign({
      assetId: 'asset-id',
      objectKey: 'private/workspaces/ws/versions/ver/asset/file.png',
      purpose: 'download',
      expiresAt: new Date(Date.now() - 1_000).toISOString()
    });

    expect(() => signer.verify(token, 'download')).toThrow(/expired/i);
  });
});
