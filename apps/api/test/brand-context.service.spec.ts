import { describe, expect, it, vi } from 'vitest';
import { BrandContextService, validateBrandOutputAgainstPackage } from '../src/brand-context/brand-context.service';

describe('BrandContextService', () => {
  it('returns an empty current result when no canonical package is active yet', async () => {
    const dataSource = {
      query: vi
        .fn()
        .mockResolvedValueOnce([{ id: 'project-id' }])
        .mockResolvedValueOnce([])
    };
    const service = new BrandContextService(dataSource as never);

    await expect(service.current('workspace-id', 'project-id')).resolves.toEqual({
      brandContextPackage: null
    });
  });

  it('publishes a context package and pins it to the identity project', async () => {
    const packageJson = {
      schemaVersion: 1,
      project: { metadata: {} },
      assets: [{ source: 'AI_GENERATED' }]
    };
    const manager = {
      query: vi
        .fn()
        .mockResolvedValueOnce([{ package_json: packageJson }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ next_revision: '3' }])
        .mockResolvedValueOnce([{ id: 'package-id' }])
        .mockResolvedValueOnce([])
    };
    const service = new BrandContextService({ manager } as never);

    await expect(
      service.publishForActivation(manager as never, 'workspace-id', 'project-id', 'version-id', 'user-id')
    ).resolves.toEqual({
      packageId: 'package-id',
      checksum: expect.stringMatching(/^[a-f0-9]{64}$/)
    });

    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE identity_projects'), [
      'package-id',
      'project-id',
      'workspace-id'
    ]);
  });

  it('approves output that uses approved brand colors, fonts, and assets', () => {
    const result = validateBrandOutputAgainstPackage(testPackageSnapshot(), {
      content: 'Nimbus helps teams automate every brand touchpoint.',
      colors: ['0F766E', '#111827'],
      fonts: ['Inter'],
      assetIds: ['asset-id'],
      brandContextPackageChecksumSha256: 'a'.repeat(64)
    });

    expect(result).toMatchObject({
      approved: true,
      score: 100,
      issues: []
    });
  });

  it('flags checksum drift, off-brand colors, and unknown assets', () => {
    const result = validateBrandOutputAgainstPackage(testPackageSnapshot(), {
      content: 'A generic automation landing page.',
      colors: ['#FF00FF'],
      fonts: ['Papyrus'],
      assetIds: ['00000000-0000-0000-0000-000000000000'],
      brandContextPackageChecksumSha256: 'b'.repeat(64)
    });

    expect(result.approved).toBe(false);
    expect(result.score).toBeLessThan(75);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'BRAND_CONTEXT_CHECKSUM_MISMATCH',
        'BRAND_ASSET_NOT_IN_CONTEXT',
        'BRAND_COLOR_OUT_OF_PALETTE',
        'BRAND_FONT_OUT_OF_SYSTEM',
        'BRAND_NAME_NOT_REFERENCED'
      ])
    );
  });
});

function testPackageSnapshot() {
  return {
    id: 'package-id',
    checksumSha256: 'a'.repeat(64),
    packageJson: {
      project: { name: 'Nimbus' },
      visualDirection: {
        colors: [
          { hex: '#0F766E', name: 'Primary' },
          { hex: '#111827', name: 'Ink' }
        ],
        fonts: [{ family: 'Inter' }, { family: 'IBM Plex Mono' }]
      },
      logo: {
        assets: [{ id: 'logo-asset-id' }]
      },
      assets: [{ id: 'asset-id', source: 'AI_GENERATED' }],
      strategy: {
        rules: []
      }
    }
  };
}
