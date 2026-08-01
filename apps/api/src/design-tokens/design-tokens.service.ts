import { createHash } from 'crypto';
import { compileBrandDesignTokens, stableStringify } from '@wuzzify/brand-design-tokens';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DomainError } from '../common/domain-error';

type TokenFormat = 'JSON' | 'CSS' | 'SCSS' | 'TAILWIND';

type TokenContext = {
  project_name: string;
  visual_direction_id: string;
  selected_logo_concept_id: string | null;
  colors: Array<{ token_name: string; name: string; hex: string; usage: string | null }>;
  fonts: Array<{ role: string; family: string; fallback: string; weights: number[]; license_status: string }>;
  logo_asset_ids: string[];
};

@Injectable()
export class DesignTokensService {
  constructor(private readonly dataSource: DataSource) {}

  async compile(workspaceId: string, projectId: string, versionId: string) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const context = await this.loadContext(projectId, versionId);
    const fingerprint = createHash('sha256').update(stableStringify(context)).digest('hex');
    const compiled = compileBrandDesignTokens({
      versionId,
      name: context.project_name,
      colors: context.colors.map((color) => ({
        tokenName: color.token_name,
        name: color.name,
        hex: color.hex,
        usage: color.usage
      })),
      fonts: context.fonts.map((font) => ({
        role: font.role,
        family: font.family,
        fallback: font.fallback,
        weights: font.weights,
        licenseStatus: font.license_status
      })),
      selectedLogoConceptId: context.selected_logo_concept_id,
      logoAssetIds: context.logo_asset_ids
    });

    return this.dataSource.transaction(async (manager) => {
      const payloads: Array<{ format: TokenFormat; checksum: string; contentJson?: unknown; contentText?: string }> = [
        { format: 'JSON', checksum: compiled.checksumSha256, contentJson: compiled.canonical },
        { format: 'CSS', checksum: sha(compiled.css), contentText: compiled.css },
        { format: 'SCSS', checksum: sha(compiled.scss), contentText: compiled.scss },
        { format: 'TAILWIND', checksum: sha(compiled.tailwind), contentText: compiled.tailwind }
      ];
      const inserted = [];

      for (const payload of payloads) {
        await manager.query(`UPDATE design_token_sets SET is_current = false WHERE identity_version_id = $1 AND format = $2 AND is_current`, [
          versionId,
          payload.format
        ]);
        const revisionRows = await manager.query<{ next_revision: string }[]>(
          `SELECT COALESCE(MAX(revision), 0) + 1 AS next_revision
           FROM design_token_sets
           WHERE identity_version_id = $1 AND format = $2`,
          [versionId, payload.format]
        );
        const rows = await manager.query(
          `INSERT INTO design_token_sets (
            identity_version_id, visual_direction_id, selected_logo_concept_id, format, revision,
            is_current, checksum_sha256, content_json, content_text, source_fingerprint_sha256
          )
          VALUES ($1, $2, $3, $4, $5, true, $6, $7::jsonb, $8, $9)
          RETURNING *`,
          [
            versionId,
            context.visual_direction_id,
            context.selected_logo_concept_id,
            payload.format,
            Number(revisionRows[0]?.next_revision ?? 1),
            payload.checksum,
            payload.contentJson ? JSON.stringify(payload.contentJson) : null,
            payload.contentText ?? null,
            fingerprint
          ]
        );
        inserted.push(rows[0]);
      }

      return { tokenSets: inserted, canonicalChecksum: compiled.checksumSha256, sourceFingerprint: fingerprint };
    });
  }

  async listCurrent(workspaceId: string, projectId: string, versionId: string) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    return this.dataSource.query(
      `SELECT * FROM design_token_sets
       WHERE identity_version_id = $1 AND is_current
       ORDER BY format ASC`,
      [versionId]
    );
  }

  async getCurrent(workspaceId: string, projectId: string, versionId: string, format: TokenFormat) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const rows = await this.dataSource.query(
      `SELECT * FROM design_token_sets
       WHERE identity_version_id = $1 AND format = $2 AND is_current`,
      [versionId, format]
    );
    if (!rows[0]) throw new DomainError('DESIGN_TOKENS_NOT_FOUND', 'Current design tokens were not found.', 404);
    return rows[0];
  }

  private async loadContext(projectId: string, versionId: string): Promise<TokenContext> {
    const rows = await this.dataSource.query<Array<{ context_json: TokenContext }>>(
      `SELECT jsonb_build_object(
        'project_name', identity_projects.name,
        'visual_direction_id', visual_directions.id,
        'selected_logo_concept_id', selected_logo.id,
        'colors', COALESCE((SELECT jsonb_agg(to_jsonb(visual_colors) ORDER BY sort_order) FROM visual_colors WHERE visual_direction_id = visual_directions.id), '[]'::jsonb),
        'fonts', COALESCE((SELECT jsonb_agg(to_jsonb(visual_fonts) ORDER BY sort_order) FROM visual_fonts WHERE visual_direction_id = visual_directions.id), '[]'::jsonb),
        'logo_asset_ids', COALESCE((
          SELECT jsonb_agg(brand_assets.id ORDER BY logo_concept_assets.sort_order)
          FROM logo_concept_assets
          JOIN brand_assets ON brand_assets.id = logo_concept_assets.brand_asset_id AND brand_assets.status = 'AVAILABLE'
          WHERE logo_concept_assets.logo_concept_id = selected_logo.id
        ), '[]'::jsonb)
      ) AS context_json
       FROM identity_projects
       JOIN identity_versions ON identity_versions.identity_project_id = identity_projects.id
       JOIN visual_directions ON visual_directions.identity_version_id = identity_versions.id AND visual_directions.is_selected AND visual_directions.status = 'ACTIVE'
       LEFT JOIN logo_concepts selected_logo ON selected_logo.identity_version_id = identity_versions.id AND selected_logo.status = 'SELECTED'
       WHERE identity_projects.id = $1 AND identity_versions.id = $2`,
      [projectId, versionId]
    );
    const context = rows[0]?.context_json;
    if (!context) throw new DomainError('TOKEN_CONTEXT_INCOMPLETE', 'Select a visual direction before compiling design tokens.', 409);
    if (!context.colors.length) throw new DomainError('TOKEN_CONTEXT_INCOMPLETE', 'Selected visual direction has no colors.', 409);
    if (!context.fonts.length) throw new DomainError('TOKEN_CONTEXT_INCOMPLETE', 'Selected visual direction has no fonts.', 409);
    return context;
  }

  private async assertVersionAccess(workspaceId: string, projectId: string, versionId: string) {
    const rows = await this.dataSource.query(
      `SELECT identity_versions.id
       FROM identity_versions
       JOIN identity_projects ON identity_projects.id = identity_versions.identity_project_id
       WHERE identity_versions.id = $1 AND identity_projects.id = $2 AND identity_projects.workspace_id = $3 AND identity_projects.status = 'ACTIVE'`,
      [versionId, projectId, workspaceId]
    );
    if (!rows[0]) throw new DomainError('IDENTITY_VERSION_NOT_FOUND', 'Identity version was not found.', 404);
  }
}

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
