import { describe, expect, it } from 'vitest';
import { QualityReviewGenerator } from './quality-review-generator.js';

const packageJson = {
  project: { name: 'Nimbus' },
  brief: { industry: 'Automation', positioning: 'Nimbus automates brand operations.' },
  strategy: {
    positioning: 'Nimbus is the operating system for brand consistency.',
    valueProposition: 'Keep every output on brand.'
  },
  visualDirection: {
    colors: [{ hex: '#0F766E' }, { hex: '#111827' }],
    fonts: [{ family: 'Inter' }, { family: 'IBM Plex Mono' }]
  },
  assets: [{ id: '11111111-1111-4111-8111-111111111111' }]
};

describe('QualityReviewGenerator', () => {
  it('reviews the pinned identity package when no explicit output is supplied', async () => {
    const result = await new QualityReviewGenerator().generate({
      id: 'job-id',
      identityVersionId: 'version-id',
      brandContextPackageId: 'package-id',
      brandContextPackageChecksumSha256: 'a'.repeat(64),
      brandContextPackage: packageJson,
      workflowStageKey: 'FINALIZE',
      task: 'QUALITY_REVIEW',
      tier: 'BALANCED',
      input: {}
    });

    expect(result.artifactName).toBe('Brand compliance review');
    expect(result.actualProvider).toBe('local');
    expect(result.contentJson).toMatchObject({
      mode: 'IDENTITY_PACKAGE',
      review: {
        approved: true,
        score: 100
      }
    });
  });

  it('flags off-brand supplied output', async () => {
    const result = await new QualityReviewGenerator().generate({
      id: 'job-id',
      identityVersionId: 'version-id',
      brandContextPackageId: 'package-id',
      brandContextPackageChecksumSha256: 'a'.repeat(64),
      brandContextPackage: packageJson,
      workflowStageKey: 'FINALIZE',
      task: 'QUALITY_REVIEW',
      tier: 'BALANCED',
      input: {
        content: 'Generic copy without the brand.',
        colors: ['#FF00FF'],
        fonts: ['Papyrus'],
        assetIds: ['22222222-2222-4222-8222-222222222222']
      }
    });

    const review = result.parsedResponse as { approved: boolean; issues: Array<{ code: string }> };
    expect(result.contentJson).toMatchObject({ mode: 'OUTPUT' });
    expect(review.approved).toBe(false);
    expect(review.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['BRAND_COLOR_OUT_OF_PALETTE', 'BRAND_FONT_OUT_OF_SYSTEM', 'BRAND_ASSET_NOT_IN_CONTEXT'])
    );
  });

  it('requires a pinned brand context package', async () => {
    await expect(
      new QualityReviewGenerator().generate({
        id: 'job-id',
        identityVersionId: 'version-id',
        brandContextPackageId: null,
        brandContextPackageChecksumSha256: null,
        brandContextPackage: null,
        workflowStageKey: 'FINALIZE',
        task: 'QUALITY_REVIEW',
        tier: 'BALANCED',
        input: {}
      })
    ).rejects.toThrow('BRAND_CONTEXT_PACKAGE_REQUIRED');
  });
});
