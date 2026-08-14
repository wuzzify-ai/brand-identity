import { Injectable } from '@nestjs/common';
import type { StageGenerationJob, StageGenerationResult, StageGenerator } from '../generations/stage-generator.factory.js';
import { validateBrandOutputAgainstPackage } from './brand-compliance.js';

type QualityReviewInput = {
  content?: string;
  colors?: string[];
  fonts?: string[];
  assetIds?: string[];
  brandContextPackageChecksumSha256?: string;
};

@Injectable()
export class QualityReviewGenerator implements StageGenerator {
  async generate(job: StageGenerationJob): Promise<StageGenerationResult> {
    if (!job.brandContextPackageId || !job.brandContextPackageChecksumSha256 || !job.brandContextPackage) {
      throw new Error('BRAND_CONTEXT_PACKAGE_REQUIRED: Quality review requires an activated brand context package.');
    }

    const input = normalizeInput(job.input, job.brandContextPackage, job.brandContextPackageChecksumSha256);
    const review = validateBrandOutputAgainstPackage(
      {
        id: job.brandContextPackageId,
        checksumSha256: job.brandContextPackageChecksumSha256,
        packageJson: job.brandContextPackage
      },
      input
    );

    return {
      artifactName: 'Brand compliance review',
      artifactKind: 'JSON',
      contentJson: {
        review,
        reviewedAt: new Date(0).toISOString(),
        mode: hasExplicitReviewInput(job.input) ? 'OUTPUT' : 'IDENTITY_PACKAGE'
      },
      sanitizedRequest: {
        task: job.task,
        brandContextPackageId: job.brandContextPackageId,
        brandContextPackageChecksumSha256: job.brandContextPackageChecksumSha256,
        input
      },
      parsedResponse: review,
      actualModel: 'deterministic-brand-compliance-v1',
      actualProvider: 'local',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostMicroUsd: 0,
      latencyMs: 0
    };
  }
}

function normalizeInput(
  rawInput: Record<string, unknown>,
  packageJson: Record<string, unknown>,
  pinnedChecksum: string
): QualityReviewInput {
  if (hasExplicitReviewInput(rawInput)) {
    const input: QualityReviewInput = {
      brandContextPackageChecksumSha256: readOptionalString(rawInput.brandContextPackageChecksumSha256) ?? pinnedChecksum
    };
    const content = readOptionalString(rawInput.content);
    const colors = readStringArray(rawInput.colors);
    const fonts = readStringArray(rawInput.fonts);
    const assetIds = readStringArray(rawInput.assetIds);

    if (content !== undefined) input.content = content;
    if (colors !== undefined) input.colors = colors;
    if (fonts !== undefined) input.fonts = fonts;
    if (assetIds !== undefined) input.assetIds = assetIds;
    return input;
  }

  return {
    content: identityPackageText(packageJson),
    colors: packageColors(packageJson),
    fonts: packageFonts(packageJson),
    assetIds: packageAssetIds(packageJson),
    brandContextPackageChecksumSha256: pinnedChecksum
  };
}

function hasExplicitReviewInput(input: Record<string, unknown>): boolean {
  return ['content', 'colors', 'fonts', 'assetIds', 'brandContextPackageChecksumSha256'].some((key) => key in input);
}

function identityPackageText(packageJson: Record<string, unknown>): string {
  const project = packageJson.project as { name?: string } | undefined;
  const brief = packageJson.brief as { industry?: string; positioning?: string } | undefined;
  const strategy = packageJson.strategy as {
    positioning?: string;
    valueProposition?: string;
    mission?: string;
    vision?: string;
    essence?: string;
    promise?: string;
  } | undefined;

  return [
    project?.name,
    brief?.industry,
    brief?.positioning,
    strategy?.positioning,
    strategy?.valueProposition,
    strategy?.mission,
    strategy?.vision,
    strategy?.essence,
    strategy?.promise
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n');
}

function packageColors(packageJson: Record<string, unknown>): string[] {
  const visualDirection = packageJson.visualDirection as { colors?: unknown } | undefined;
  return readArray<{ hex?: unknown }>(visualDirection?.colors)
    .map((color) => color.hex)
    .filter((value): value is string => typeof value === 'string');
}

function packageFonts(packageJson: Record<string, unknown>): string[] {
  const visualDirection = packageJson.visualDirection as { fonts?: unknown } | undefined;
  return readArray<{ family?: unknown }>(visualDirection?.fonts)
    .map((font) => font.family)
    .filter((value): value is string => typeof value === 'string');
}

function packageAssetIds(packageJson: Record<string, unknown>): string[] {
  return readArray<{ id?: unknown }>(packageJson.assets)
    .map((asset) => asset.id)
    .filter((value): value is string => typeof value === 'string');
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
