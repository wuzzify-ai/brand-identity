export type BrandComplianceIssue = {
  code: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  path?: string;
  metadata?: Record<string, unknown>;
};

export type BrandComplianceResult = {
  approved: boolean;
  score: number;
  issues: BrandComplianceIssue[];
  brandContextPackageId: string;
  brandContextPackageChecksumSha256: string;
};

export function validateBrandOutputAgainstPackage(
  packageSnapshot: { id: string; checksumSha256: string; packageJson: Record<string, unknown> },
  input: {
    content?: string;
    colors?: string[];
    fonts?: string[];
    assetIds?: string[];
    brandContextPackageChecksumSha256?: string;
  }
): BrandComplianceResult {
  const issues: BrandComplianceIssue[] = [];
  const packageJson = packageSnapshot.packageJson;

  if (
    input.brandContextPackageChecksumSha256 &&
    input.brandContextPackageChecksumSha256 !== packageSnapshot.checksumSha256
  ) {
    issues.push({
      code: 'BRAND_CONTEXT_CHECKSUM_MISMATCH',
      severity: 'ERROR',
      message: 'The output was validated against a different brand context package checksum.',
      path: 'brandContextPackageChecksumSha256'
    });
  }

  validateAssetIds(packageJson, input.assetIds ?? [], issues);
  validateColors(packageJson, input.colors ?? [], issues);
  validateFonts(packageJson, input.fonts ?? [], issues);
  validateContent(packageJson, input.content, issues);

  const score = scoreIssues(issues);
  return {
    approved: !issues.some((issue) => issue.severity === 'ERROR') && score >= 75,
    score,
    issues,
    brandContextPackageId: packageSnapshot.id,
    brandContextPackageChecksumSha256: packageSnapshot.checksumSha256
  };
}

function validateAssetIds(packageJson: Record<string, unknown>, assetIds: string[], issues: BrandComplianceIssue[]) {
  if (!assetIds.length) return;
  const logo = packageJson.logo as { assets?: unknown } | undefined;
  const allowed = new Set([
    ...readArray<{ id?: string }>(packageJson.assets).map((asset) => asset.id).filter(isString),
    ...readArray<{ id?: string }>(logo?.assets).map((asset) => asset.id).filter(isString)
  ]);
  for (const assetId of assetIds) {
    if (!allowed.has(assetId)) {
      issues.push({
        code: 'BRAND_ASSET_NOT_IN_CONTEXT',
        severity: 'ERROR',
        message: `Asset ${assetId} is not part of this approved brand context package.`,
        path: 'assetIds',
        metadata: { assetId }
      });
    }
  }
}

function validateColors(packageJson: Record<string, unknown>, colors: string[], issues: BrandComplianceIssue[]) {
  if (!colors.length) return;
  const visualDirection = packageJson.visualDirection as { colors?: unknown } | undefined;
  const allowed = new Set(
    readArray<{ hex?: string }>(visualDirection?.colors)
      .map((color) => normalizeHex(color.hex))
      .filter(isString)
  );
  for (const color of colors) {
    const normalized = normalizeHex(color);
    if (!normalized || !allowed.has(normalized)) {
      issues.push({
        code: normalized ? 'BRAND_COLOR_OUT_OF_PALETTE' : 'BRAND_COLOR_INVALID',
        severity: 'ERROR',
        message: normalized ? `Color ${normalized} is not in the approved brand palette.` : `Color ${color} is invalid.`,
        path: 'colors'
      });
    }
  }
}

function validateFonts(packageJson: Record<string, unknown>, fonts: string[], issues: BrandComplianceIssue[]) {
  if (!fonts.length) return;
  const visualDirection = packageJson.visualDirection as { fonts?: unknown } | undefined;
  const allowed = new Set(
    readArray<{ family?: string }>(visualDirection?.fonts)
      .map((font) => normalizeName(font.family))
      .filter(isString)
  );
  for (const font of fonts) {
    if (!allowed.has(normalizeName(font))) {
      issues.push({
        code: 'BRAND_FONT_OUT_OF_SYSTEM',
        severity: 'WARNING',
        message: `Font ${font} is not part of the approved brand typography system.`,
        path: 'fonts'
      });
    }
  }
}

function validateContent(packageJson: Record<string, unknown>, content: string | undefined, issues: BrandComplianceIssue[]) {
  const project = packageJson.project as { name?: string } | undefined;
  const brandName = normalizeName(project?.name);
  const normalizedContent = normalizeName(content);
  if (brandName && normalizedContent && !normalizedContent.includes(brandName)) {
    issues.push({
      code: 'BRAND_NAME_NOT_REFERENCED',
      severity: 'INFO',
      message: 'The content does not mention the approved brand name.',
      path: 'content'
    });
  }
}

function scoreIssues(issues: BrandComplianceIssue[]): number {
  return Math.max(
    0,
    100 -
      issues.reduce((total, issue) => {
        if (issue.severity === 'ERROR') return total + 35;
        if (issue.severity === 'WARNING') return total + 12;
        return total + 3;
      }, 0)
  );
}

function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const prefixed = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
  return /^#[0-9A-Fa-f]{6}$/.test(prefixed) ? prefixed.toUpperCase() : null;
}

function normalizeName(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function readArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
