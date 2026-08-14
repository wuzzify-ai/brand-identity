import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { stableStringify } from '@wuzzify/brand-design-tokens';
import { DataSource, EntityManager } from 'typeorm';
import { DomainError } from '../common/domain-error';
import type { BrandContextValidationDto } from './dto/brand-context-validation.dto';

type BrandContextPackageSource = 'GENERATED' | 'IMPORTED' | 'HYBRID';
type BrandComplianceSeverity = 'ERROR' | 'WARNING' | 'INFO';

type BrandContextRow = {
  package_json: Record<string, unknown>;
};

type BrandContextPackageRow = {
  id: string;
  checksum_sha256: string;
  package_json: Record<string, unknown>;
};

export type BrandComplianceIssue = {
  code: string;
  severity: BrandComplianceSeverity;
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

@Injectable()
export class BrandContextService {
  constructor(private readonly dataSource: DataSource) {}

  async compile(workspaceId: string, projectId: string, versionId: string) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    return this.compilePackage(this.dataSource.manager, workspaceId, projectId, versionId);
  }

  async current(workspaceId: string, projectId: string) {
    await this.assertProjectAccess(workspaceId, projectId);
    const rows = await this.dataSource.query(
      `SELECT brand_context_packages.*
       FROM brand_context_packages
       JOIN identity_projects ON identity_projects.active_context_package_id = brand_context_packages.id
       WHERE identity_projects.workspace_id = $1::uuid
         AND identity_projects.id = $2::uuid
         AND identity_projects.status = 'ACTIVE'
         AND brand_context_packages.status = 'PUBLISHED'`,
      [workspaceId, projectId]
    );

    if (!rows[0]) {
      return { brandContextPackage: null };
    }

    return { brandContextPackage: rows[0] };
  }

  async list(workspaceId: string, projectId: string) {
    await this.assertProjectAccess(workspaceId, projectId);
    return this.dataSource.query(
      `SELECT id, workspace_id, identity_project_id, identity_version_id, source, status,
              revision, checksum_sha256, published_by_user_id, published_at, revoked_at,
              revocation_reason, is_current, created_at, updated_at
       FROM brand_context_packages
       WHERE workspace_id = $1::uuid AND identity_project_id = $2::uuid
       ORDER BY revision DESC, published_at DESC`,
      [workspaceId, projectId]
    );
  }

  async get(workspaceId: string, projectId: string, packageId: string) {
    await this.assertProjectAccess(workspaceId, projectId);
    const rows = await this.dataSource.query(
      `SELECT *
       FROM brand_context_packages
       WHERE id = $1::uuid AND workspace_id = $2::uuid AND identity_project_id = $3::uuid`,
      [packageId, workspaceId, projectId]
    );

    if (!rows[0]) {
      throw new DomainError('BRAND_CONTEXT_PACKAGE_NOT_FOUND', 'Brand context package was not found.', 404);
    }

    return { brandContextPackage: rows[0] };
  }

  async validateCurrent(workspaceId: string, projectId: string, dto: BrandContextValidationDto) {
    await this.assertProjectAccess(workspaceId, projectId);
    const rows = await this.dataSource.query<BrandContextPackageRow[]>(
      `SELECT brand_context_packages.id, brand_context_packages.checksum_sha256, brand_context_packages.package_json
       FROM brand_context_packages
       JOIN identity_projects ON identity_projects.active_context_package_id = brand_context_packages.id
       WHERE identity_projects.workspace_id = $1::uuid
         AND identity_projects.id = $2::uuid
         AND identity_projects.status = 'ACTIVE'
         AND brand_context_packages.status = 'PUBLISHED'`,
      [workspaceId, projectId]
    );

    const packageRow = rows[0];
    if (!packageRow) {
      throw new DomainError('BRAND_CONTEXT_PACKAGE_REQUIRED', 'Activate an approved brand identity before validating brand output.', 409);
    }

    return validatePackageRow(packageRow, dto);
  }

  async validatePackage(workspaceId: string, projectId: string, packageId: string, dto: BrandContextValidationDto) {
    await this.assertProjectAccess(workspaceId, projectId);
    const rows = await this.dataSource.query<BrandContextPackageRow[]>(
      `SELECT id, checksum_sha256, package_json
       FROM brand_context_packages
       WHERE id = $1::uuid
         AND workspace_id = $2::uuid
         AND identity_project_id = $3::uuid
         AND status = 'PUBLISHED'`,
      [packageId, workspaceId, projectId]
    );

    const packageRow = rows[0];
    if (!packageRow) {
      throw new DomainError('BRAND_CONTEXT_PACKAGE_NOT_FOUND', 'Brand context package was not found.', 404);
    }

    return validatePackageRow(packageRow, dto);
  }

  async publishForActivation(
    manager: Pick<EntityManager, 'query'>,
    workspaceId: string,
    projectId: string,
    versionId: string,
    userId: string
  ) {
    const compiled = await this.compilePackage(manager, workspaceId, projectId, versionId);
    const packageJson = stableStringify(compiled.package);
    const checksum = sha(packageJson);

    await manager.query(
      `UPDATE brand_context_packages
       SET is_current = false, updated_at = now()
       WHERE identity_project_id = $1::uuid AND is_current`,
      [projectId]
    );

    const revisionRows = await manager.query<{ next_revision: string }[]>(
      `SELECT COALESCE(MAX(revision), 0) + 1 AS next_revision
       FROM brand_context_packages
       WHERE identity_project_id = $1::uuid`,
      [projectId]
    );
    const rows = await manager.query<{ id: string }[]>(
      `INSERT INTO brand_context_packages (
        workspace_id, identity_project_id, identity_version_id, source, revision,
        package_json, checksum_sha256, published_by_user_id, is_current
       )
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::jsonb, $7, $8::uuid, true)
       RETURNING id`,
      [
        workspaceId,
        projectId,
        versionId,
        compiled.source,
        Number(revisionRows[0]?.next_revision ?? 1),
        packageJson,
        checksum,
        userId
      ]
    );
    const packageId = rows[0]?.id as string;

    await manager.query(
      `UPDATE identity_projects
       SET active_context_package_id = $1::uuid, updated_at = now()
       WHERE id = $2::uuid AND workspace_id = $3::uuid`,
      [packageId, projectId, workspaceId]
    );

    return { packageId, checksum };
  }

  private async compilePackage(manager: Pick<EntityManager, 'query'>, workspaceId: string, projectId: string, versionId: string) {
    const rows = await manager.query<BrandContextRow[]>(
      `SELECT jsonb_build_object(
        'schemaVersion', 1,
        'workspaceId', $1::uuid,
        'identityProjectId', $2::uuid,
        'identityVersionId', $3::uuid,
        'compiledAt', to_jsonb(now()),
        'project', jsonb_build_object(
          'id', identity_projects.id,
          'name', identity_projects.name,
          'slug', identity_projects.slug,
          'metadata', identity_projects.metadata
        ),
        'version', jsonb_build_object(
          'id', identity_versions.id,
          'versionNumber', identity_versions.version_number,
          'status', identity_versions.status,
          'approvedAt', identity_versions.approved_at,
          'activatedAt', identity_versions.activated_at
        ),
        'brief', (
          SELECT jsonb_build_object(
            'id', brand_briefs.id,
            'industry', brand_briefs.industry,
            'positioning', brand_briefs.positioning,
            'languages', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'languageCode', brand_brief_languages.language_code,
              'displayName', brand_brief_languages.display_name,
              'isPrimary', brand_brief_languages.is_primary
            ) ORDER BY brand_brief_languages.sort_order, brand_brief_languages.id) FROM brand_brief_languages WHERE brand_brief_languages.brand_brief_id = brand_briefs.id), '[]'::jsonb),
            'audiences', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'name', brand_brief_audiences.name,
              'description', brand_brief_audiences.description
            ) ORDER BY brand_brief_audiences.sort_order, brand_brief_audiences.id) FROM brand_brief_audiences WHERE brand_brief_audiences.brand_brief_id = brand_briefs.id), '[]'::jsonb),
            'markets', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'name', brand_brief_markets.name,
              'region', brand_brief_markets.region
            ) ORDER BY brand_brief_markets.sort_order, brand_brief_markets.id) FROM brand_brief_markets WHERE brand_brief_markets.brand_brief_id = brand_briefs.id), '[]'::jsonb),
            'offerings', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'name', brand_brief_offerings.name,
              'description', brand_brief_offerings.description
            ) ORDER BY brand_brief_offerings.sort_order, brand_brief_offerings.id) FROM brand_brief_offerings WHERE brand_brief_offerings.brand_brief_id = brand_briefs.id), '[]'::jsonb),
            'preferences', COALESCE((SELECT jsonb_agg(brand_brief_preferences.text ORDER BY brand_brief_preferences.sort_order, brand_brief_preferences.id) FROM brand_brief_preferences WHERE brand_brief_preferences.brand_brief_id = brand_briefs.id), '[]'::jsonb),
            'constraints', COALESCE((SELECT jsonb_agg(brand_brief_constraints.text ORDER BY brand_brief_constraints.sort_order, brand_brief_constraints.id) FROM brand_brief_constraints WHERE brand_brief_constraints.brand_brief_id = brand_briefs.id), '[]'::jsonb)
          )
          FROM brand_briefs
          WHERE brand_briefs.identity_version_id = $3::uuid
        ),
        'strategy', (
          SELECT jsonb_build_object(
            'id', brand_strategies.id,
            'positioning', brand_strategies.positioning,
            'valueProposition', brand_strategies.value_proposition,
            'mission', brand_strategies.mission,
            'vision', brand_strategies.vision,
            'essence', brand_strategies.essence,
            'promise', brand_strategies.promise,
            'values', COALESCE((SELECT jsonb_agg(brand_strategy_values.text ORDER BY brand_strategy_values.sort_order, brand_strategy_values.id) FROM brand_strategy_values WHERE brand_strategy_values.brand_strategy_id = brand_strategies.id), '[]'::jsonb),
            'rules', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'text', brand_strategy_rules.text,
              'legalReviewRequired', brand_strategy_rules.legal_review_required
            ) ORDER BY brand_strategy_rules.sort_order, brand_strategy_rules.id) FROM brand_strategy_rules WHERE brand_strategy_rules.brand_strategy_id = brand_strategies.id), '[]'::jsonb),
            'taglines', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'text', brand_strategy_taglines.text,
              'languageCode', brand_strategy_taglines.language_code,
              'isSelected', brand_strategy_taglines.is_selected,
              'legalReviewRequired', brand_strategy_taglines.legal_review_required
            ) ORDER BY brand_strategy_taglines.sort_order, brand_strategy_taglines.id) FROM brand_strategy_taglines WHERE brand_strategy_taglines.brand_strategy_id = brand_strategies.id), '[]'::jsonb),
            'personas', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'name', brand_strategy_personas.name,
              'segment', brand_strategy_personas.segment,
              'needs', brand_strategy_personas.needs,
              'pains', brand_strategy_personas.pains
            ) ORDER BY brand_strategy_personas.sort_order, brand_strategy_personas.id) FROM brand_strategy_personas WHERE brand_strategy_personas.brand_strategy_id = brand_strategies.id), '[]'::jsonb),
            'messagingPillars', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'title', brand_strategy_messaging_pillars.title,
              'message', brand_strategy_messaging_pillars.message,
              'proofPoints', brand_strategy_messaging_pillars.proof_points
            ) ORDER BY brand_strategy_messaging_pillars.sort_order, brand_strategy_messaging_pillars.id) FROM brand_strategy_messaging_pillars WHERE brand_strategy_messaging_pillars.brand_strategy_id = brand_strategies.id), '[]'::jsonb)
          )
          FROM brand_strategies
          WHERE brand_strategies.identity_version_id = $3::uuid
        ),
        'visualDirection', (
          SELECT jsonb_build_object(
            'id', visual_directions.id,
            'name', visual_directions.name,
            'rationale', visual_directions.rationale,
            'moodKeywords', visual_directions.mood_keywords,
            'imagery', visual_directions.imagery,
            'layoutNotes', visual_directions.layout_notes,
            'colors', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'tokenName', visual_colors.token_name,
              'name', visual_colors.name,
              'hex', visual_colors.hex,
              'rgb', visual_colors.rgb,
              'hsl', visual_colors.hsl,
              'usage', visual_colors.usage,
              'contrastOnWhite', visual_colors.contrast_on_white,
              'contrastOnBlack', visual_colors.contrast_on_black
            ) ORDER BY visual_colors.sort_order, visual_colors.id) FROM visual_colors WHERE visual_colors.visual_direction_id = visual_directions.id), '[]'::jsonb),
            'fonts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'role', visual_fonts.role,
              'family', visual_fonts.family,
              'fallback', visual_fonts.fallback,
              'weights', visual_fonts.weights,
              'supportedScripts', visual_fonts.supported_scripts,
              'source', visual_fonts.source,
              'licenseStatus', visual_fonts.license_status
            ) ORDER BY visual_fonts.sort_order, visual_fonts.id) FROM visual_fonts WHERE visual_fonts.visual_direction_id = visual_directions.id), '[]'::jsonb)
          )
          FROM visual_directions
          WHERE visual_directions.identity_version_id = $3::uuid
            AND visual_directions.is_selected
            AND visual_directions.status = 'ACTIVE'
        ),
        'logo', (
          SELECT jsonb_build_object(
            'id', logo_concepts.id,
            'type', logo_concepts.type,
            'name', logo_concepts.name,
            'rationale', logo_concepts.rationale,
            'languageCodes', logo_concepts.language_codes,
            'productionNotes', logo_concepts.production_notes,
            'reviewStatus', logo_concepts.review_status,
            'reviewWarnings', logo_concepts.review_warnings,
            'assets', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'id', brand_assets.id,
              'role', logo_concept_assets.role,
              'category', brand_assets.category,
              'source', brand_assets.source,
              'visibility', brand_assets.visibility,
              'displayName', brand_assets.display_name,
              'altText', brand_assets.alt_text,
              'mimeType', COALESCE(brand_assets.detected_mime_type, brand_assets.declared_mime_type),
              'width', brand_assets.width,
              'height', brand_assets.height,
              'publicCdnUrl', brand_assets.public_cdn_url,
              'checksumSha256', brand_assets.checksum_sha256
            ) ORDER BY logo_concept_assets.sort_order, brand_assets.id)
            FROM logo_concept_assets
            JOIN brand_assets ON brand_assets.id = logo_concept_assets.brand_asset_id
            WHERE logo_concept_assets.logo_concept_id = logo_concepts.id
              AND brand_assets.status = 'AVAILABLE'), '[]'::jsonb)
          )
          FROM logo_concepts
          WHERE logo_concepts.identity_version_id = $3::uuid
            AND logo_concepts.status = 'SELECTED'
        ),
        'designTokens', (
          SELECT jsonb_build_object(
            'id', design_token_sets.id,
            'format', design_token_sets.format,
            'revision', design_token_sets.revision,
            'checksumSha256', design_token_sets.checksum_sha256,
            'content', design_token_sets.content_json
          )
          FROM design_token_sets
          WHERE design_token_sets.identity_version_id = $3::uuid
            AND design_token_sets.format = 'JSON'
            AND design_token_sets.is_current
        ),
        'brandBook', (
          SELECT jsonb_build_object(
            'id', brand_books.id,
            'revision', brand_books.revision,
            'status', brand_books.status,
            'manifestChecksumSha256', brand_books.manifest_checksum_sha256
          )
          FROM brand_books
          WHERE brand_books.identity_version_id = $3::uuid
            AND brand_books.is_current
            AND brand_books.status = 'READY'
        ),
        'assets', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', brand_assets.id,
          'category', brand_assets.category,
          'source', brand_assets.source,
          'visibility', brand_assets.visibility,
          'displayName', brand_assets.display_name,
          'altText', brand_assets.alt_text,
          'originalFilename', brand_assets.original_filename,
          'mimeType', COALESCE(brand_assets.detected_mime_type, brand_assets.declared_mime_type),
          'byteSize', COALESCE(brand_assets.actual_byte_size, brand_assets.declared_byte_size),
          'width', brand_assets.width,
          'height', brand_assets.height,
          'publicCdnUrl', brand_assets.public_cdn_url,
          'checksumSha256', brand_assets.checksum_sha256,
          'metadata', brand_assets.metadata,
          'variants', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'id', asset_variants.id,
            'kind', asset_variants.kind,
            'mimeType', asset_variants.mime_type,
            'byteSize', asset_variants.byte_size,
            'width', asset_variants.width,
            'height', asset_variants.height,
            'checksumSha256', asset_variants.checksum_sha256,
            'metadata', asset_variants.metadata
          ) ORDER BY asset_variants.kind, asset_variants.id) FROM asset_variants WHERE asset_variants.brand_asset_id = brand_assets.id), '[]'::jsonb)
        ) ORDER BY brand_assets.category, brand_assets.created_at, brand_assets.id)
        FROM brand_assets
        WHERE brand_assets.workspace_id = $1::uuid
          AND brand_assets.identity_project_id = $2::uuid
          AND brand_assets.identity_version_id = $3::uuid
          AND brand_assets.status = 'AVAILABLE'), '[]'::jsonb),
        'usageRules', jsonb_build_object(
          'immutability', 'Use this package as the pinned source of truth for the assignment. Do not silently switch packages mid-job.',
          'assetAccess', 'Use asset ids and public CDN urls when present. Request a scoped asset URL instead of relying on private storage keys.',
          'brandCompliance', 'Run brand validation before returning deliverables that depend on this package.'
        )
      ) AS package_json
       FROM identity_projects
       JOIN identity_versions ON identity_versions.identity_project_id = identity_projects.id
       WHERE identity_projects.workspace_id = $1::uuid
         AND identity_projects.id = $2::uuid
         AND identity_projects.status = 'ACTIVE'
         AND identity_versions.id = $3::uuid`,
      [workspaceId, projectId, versionId]
    );

    const packagePayload = rows[0]?.package_json;

    if (!packagePayload) {
      throw new DomainError('IDENTITY_VERSION_NOT_FOUND', 'Identity version was not found.', 404);
    }

    return {
      source: inferSource(packagePayload),
      package: packagePayload,
      checksumSha256: sha(stableStringify(packagePayload))
    };
  }

  private async assertProjectAccess(workspaceId: string, projectId: string) {
    const rows = await this.dataSource.query(
      `SELECT id
       FROM identity_projects
       WHERE workspace_id = $1::uuid AND id = $2::uuid AND status = 'ACTIVE'`,
      [workspaceId, projectId]
    );
    if (!rows[0]) throw new DomainError('IDENTITY_PROJECT_NOT_FOUND', 'Identity project was not found.', 404);
  }

  private async assertVersionAccess(workspaceId: string, projectId: string, versionId: string) {
    const rows = await this.dataSource.query(
      `SELECT identity_versions.id
       FROM identity_versions
       JOIN identity_projects ON identity_projects.id = identity_versions.identity_project_id
       WHERE identity_versions.id = $1::uuid
         AND identity_projects.id = $2::uuid
         AND identity_projects.workspace_id = $3::uuid
         AND identity_projects.status = 'ACTIVE'`,
      [versionId, projectId, workspaceId]
    );
    if (!rows[0]) throw new DomainError('IDENTITY_VERSION_NOT_FOUND', 'Identity version was not found.', 404);
  }
}

function inferSource(packagePayload: Record<string, unknown>): BrandContextPackageSource {
  const project = packagePayload.project as { metadata?: Record<string, unknown> } | undefined;
  const explicitSource = String(project?.metadata?.identitySource ?? project?.metadata?.source ?? '').toUpperCase();

  if (explicitSource === 'IMPORTED' || explicitSource === 'HYBRID' || explicitSource === 'GENERATED') {
    return explicitSource;
  }

  const assets = Array.isArray(packagePayload.assets) ? (packagePayload.assets as Array<{ source?: string }>) : [];
  const hasImportedAsset = assets.some((asset) => asset.source === 'IMPORTED' || asset.source === 'USER_UPLOAD');
  const hasAiAsset = assets.some((asset) => asset.source === 'AI_GENERATED');

  if (hasImportedAsset && hasAiAsset) return 'HYBRID';
  if (hasImportedAsset) return 'IMPORTED';
  return 'GENERATED';
}

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function validateBrandOutputAgainstPackage(
  packageSnapshot: { id: string; checksumSha256: string; packageJson: Record<string, unknown> },
  dto: BrandContextValidationDto
): BrandComplianceResult {
  const issues: BrandComplianceIssue[] = [];
  const packageJson = packageSnapshot.packageJson;

  if (
    dto.brandContextPackageChecksumSha256 &&
    dto.brandContextPackageChecksumSha256 !== packageSnapshot.checksumSha256
  ) {
    issues.push({
      code: 'BRAND_CONTEXT_CHECKSUM_MISMATCH',
      severity: 'ERROR',
      message: 'The output was validated against a different brand context package checksum.',
      path: 'brandContextPackageChecksumSha256',
      metadata: {
        expectedChecksumSha256: packageSnapshot.checksumSha256,
        receivedChecksumSha256: dto.brandContextPackageChecksumSha256
      }
    });
  }

  validateAssetIds(packageJson, dto.assetIds ?? [], issues);
  validateColors(packageJson, dto.colors ?? [], issues);
  validateFonts(packageJson, dto.fonts ?? [], issues);
  validateContent(packageJson, dto.content, issues);

  const score = scoreIssues(issues);

  return {
    approved: !issues.some((issue) => issue.severity === 'ERROR') && score >= 75,
    score,
    issues,
    brandContextPackageId: packageSnapshot.id,
    brandContextPackageChecksumSha256: packageSnapshot.checksumSha256
  };
}

function validatePackageRow(packageRow: BrandContextPackageRow, dto: BrandContextValidationDto) {
  return validateBrandOutputAgainstPackage(
    {
      id: packageRow.id,
      checksumSha256: packageRow.checksum_sha256,
      packageJson: packageRow.package_json
    },
    dto
  );
}

function validateAssetIds(packageJson: Record<string, unknown>, assetIds: string[], issues: BrandComplianceIssue[]) {
  if (!assetIds.length) return;
  const allowedAssetIds = new Set([
    ...readArray<{ id?: string }>(packageJson.assets).map((asset) => asset.id).filter(isString),
    ...readArray<{ id?: string }>((packageJson.logo as { assets?: unknown } | undefined)?.assets).map((asset) => asset.id).filter(isString)
  ]);

  for (const assetId of assetIds) {
    if (!allowedAssetIds.has(assetId)) {
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
  const visualDirection = packageJson.visualDirection as { colors?: unknown } | null | undefined;
  const allowedColors = new Set(
    readArray<{ hex?: string }>(visualDirection?.colors)
      .map((color) => normalizeHex(color.hex))
      .filter(isString)
  );

  if (!allowedColors.size) {
    issues.push({
      code: 'BRAND_COLOR_CONTEXT_EMPTY',
      severity: 'WARNING',
      message: 'This brand context package does not contain approved color tokens.',
      path: 'colors'
    });
    return;
  }

  for (const color of colors) {
    const normalized = normalizeHex(color);
    if (!normalized) {
      issues.push({
        code: 'BRAND_COLOR_INVALID',
        severity: 'ERROR',
        message: `Color ${color} is not a valid 6-digit hex color.`,
        path: 'colors',
        metadata: { color }
      });
      continue;
    }
    if (!allowedColors.has(normalized)) {
      issues.push({
        code: 'BRAND_COLOR_OUT_OF_PALETTE',
        severity: 'ERROR',
        message: `Color ${normalized} is not in the approved brand palette.`,
        path: 'colors',
        metadata: { color: normalized, allowedColors: [...allowedColors] }
      });
    }
  }
}

function validateFonts(packageJson: Record<string, unknown>, fonts: string[], issues: BrandComplianceIssue[]) {
  if (!fonts.length) return;
  const visualDirection = packageJson.visualDirection as { fonts?: unknown } | null | undefined;
  const allowedFonts = new Set(
    readArray<{ family?: string }>(visualDirection?.fonts)
      .map((font) => normalizeName(font.family))
      .filter(isString)
  );

  if (!allowedFonts.size) {
    issues.push({
      code: 'BRAND_FONT_CONTEXT_EMPTY',
      severity: 'WARNING',
      message: 'This brand context package does not contain approved typography tokens.',
      path: 'fonts'
    });
    return;
  }

  for (const font of fonts) {
    const normalized = normalizeName(font);
    if (!allowedFonts.has(normalized)) {
      issues.push({
        code: 'BRAND_FONT_OUT_OF_SYSTEM',
        severity: 'WARNING',
        message: `Font ${font} is not part of the approved brand typography system.`,
        path: 'fonts',
        metadata: { font, allowedFonts: [...allowedFonts] }
      });
    }
  }
}

function validateContent(packageJson: Record<string, unknown>, content: string | undefined, issues: BrandComplianceIssue[]) {
  const normalizedContent = normalizeName(content);
  if (!normalizedContent) return;

  const project = packageJson.project as { name?: string } | null | undefined;
  const brandName = normalizeName(project?.name);
  if (brandName && !normalizedContent.includes(brandName)) {
    issues.push({
      code: 'BRAND_NAME_NOT_REFERENCED',
      severity: 'INFO',
      message: 'The content does not mention the approved brand name.',
      path: 'content'
    });
  }

  const strategy = packageJson.strategy as { rules?: unknown } | null | undefined;
  const legalRules = readArray<{ text?: string; legalReviewRequired?: boolean }>(strategy?.rules).filter(
    (rule) => rule.legalReviewRequired
  );
  if (legalRules.length) {
    issues.push({
      code: 'LEGAL_REVIEW_RULES_PRESENT',
      severity: 'INFO',
      message: 'This brand has legal-review rules. Human review may be required for public output.',
      path: 'content',
      metadata: { rules: legalRules.map((rule) => rule.text).filter(isString) }
    });
  }
}

function scoreIssues(issues: BrandComplianceIssue[]): number {
  const penalty = issues.reduce((total, issue) => {
    if (issue.severity === 'ERROR') return total + 35;
    if (issue.severity === 'WARNING') return total + 12;
    return total + 3;
  }, 0);
  return Math.max(0, 100 - penalty);
}

function readArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#[0-9A-Fa-f]{6}$/.test(prefixed) ? prefixed.toUpperCase() : null;
}

function normalizeName(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
