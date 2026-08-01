import { describe, expect, it } from 'vitest';
import { compileBrandDesignTokens } from './index';

describe('compileBrandDesignTokens', () => {
  const input = {
    versionId: 'version-id',
    name: 'Nimbus',
    colors: [
      { tokenName: 'brand-primary', name: 'Primary', hex: '#0f766e', usage: 'Primary actions' },
      { tokenName: 'brand-accent', name: 'Accent', hex: '#f97316', usage: 'Highlights' }
    ],
    fonts: [{ role: 'heading', family: 'Inter', fallback: 'Arial, sans-serif', weights: [400, 700], licenseStatus: 'OPEN' }],
    selectedLogoConceptId: 'concept-id',
    logoAssetIds: ['b', 'a']
  };

  it('produces deterministic canonical JSON and checksum', () => {
    const first = compileBrandDesignTokens(input);
    const second = compileBrandDesignTokens({ ...input, colors: [...input.colors].reverse() });

    expect(first.canonicalJson).toBe(second.canonicalJson);
    expect(first.checksumSha256).toBe(second.checksumSha256);
  });

  it('escapes CSS-like output values', () => {
    const result = compileBrandDesignTokens({
      ...input,
      fonts: [{ role: 'body', family: 'Inter; color:red', fallback: 'Arial{}', weights: [400], licenseStatus: 'OPEN' }]
    });

    expect(result.css).not.toContain('color:red');
    expect(result.scss).not.toContain('{}');
  });
});
