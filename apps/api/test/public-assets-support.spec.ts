import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { AssetUrlSigner } from '../src/assets/storage/asset-url-signer.service';

describe('public asset upload grants', () => {
  const signer = new AssetUrlSigner(
    new ConfigService({
      JWT_ACCESS_SECRET: 'public-asset-test-secret-that-is-long-enough'
    })
  );

  it('does not expose storage credentials in anonymous upload URLs', () => {
    const token = signer.sign({
      assetId: 'asset-id',
      objectKey: 'anonymous/quarantine/projects/project-id/grants/grant-id/logo.png',
      purpose: 'upload',
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    const uploadUrl = `http://localhost:4000/v1/asset-upload-objects/asset-id?token=${encodeURIComponent(token)}`;

    expect(uploadUrl).not.toContain('S3_ACCESS_KEY_ID');
    expect(uploadUrl).not.toContain('S3_SECRET_ACCESS_KEY');
    expect(uploadUrl).not.toContain('brand_identity_minio');
    expect(signer.verify(token, 'upload').objectKey).toMatch(/^anonymous\/quarantine\//);
  });

  it('binds upload tokens to their purpose', () => {
    const token = signer.sign({
      assetId: 'asset-id',
      objectKey: 'anonymous/quarantine/projects/project-id/grants/grant-id/logo.png',
      purpose: 'upload',
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });

    expect(() => signer.verify(token, 'download')).toThrow(/purpose/i);
  });
});
