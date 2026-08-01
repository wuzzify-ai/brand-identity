import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DomainError } from '../common/domain-error';
import { WorkflowStageKey, WorkflowStageStatus } from '../database/entities';
import { deriveColorMetrics } from './color-utils';
import { validateFontRole, validateFontWeights } from './font-validation';
import type { CreateVisualDirectionDto, SelectVisualDirectionDto, UpdateVisualDirectionDto, VisualColorDto, VisualFontDto } from './dto/visual-direction.dto';

interface VisualDirectionRow {
  id: string;
  identity_version_id: string;
  lock_version: number;
  is_selected: boolean;
}

@Injectable()
export class VisualDirectionsService {
  constructor(private readonly dataSource: DataSource) {}

  async list(workspaceId: string, projectId: string, versionId: string) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    return this.dataSource.query(
      `SELECT * FROM visual_directions
       WHERE identity_version_id = $1 AND status = 'ACTIVE'
       ORDER BY is_selected DESC, updated_at DESC, id DESC`,
      [versionId]
    );
  }

  async get(workspaceId: string, projectId: string, versionId: string, directionId: string) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    return this.readAggregate(directionId, versionId);
  }

  async create(workspaceId: string, projectId: string, dto: CreateVisualDirectionDto) {
    await this.assertVersionAccess(workspaceId, projectId, dto.identityVersionId);
    await this.assertStrategyComplete(dto.identityVersionId);

    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<VisualDirectionRow[]>(
        `INSERT INTO visual_directions (identity_version_id, name, rationale, mood_keywords, imagery, layout_notes, origin)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, 'USER')
         RETURNING *`,
        [
          dto.identityVersionId,
          dto.name.trim(),
          normalizeText(dto.rationale),
          JSON.stringify(dto.moodKeywords ?? []),
          JSON.stringify(dto.imagery ?? []),
          JSON.stringify(dto.layoutNotes ?? [])
        ]
      );
      const direction = rows[0] as VisualDirectionRow;
      await this.replaceChildren(manager, direction.id, dto.colors ?? [], dto.fonts ?? []);
      return this.readAggregate(direction.id, dto.identityVersionId, manager);
    });
  }

  async update(workspaceId: string, projectId: string, versionId: string, directionId: string, dto: UpdateVisualDirectionDto) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    await this.assertStrategyComplete(versionId);

    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<VisualDirectionRow[]>(
        `SELECT * FROM visual_directions WHERE id = $1 AND identity_version_id = $2 AND status = 'ACTIVE' FOR UPDATE`,
        [directionId, versionId]
      );
      const direction = rows[0];

      if (!direction) throw new DomainError('VISUAL_DIRECTION_NOT_FOUND', 'Visual direction was not found.', 404);
      if (direction.lock_version !== dto.lockVersion) {
        throw new DomainError('VISUAL_DIRECTION_UPDATE_CONFLICT', 'Visual direction was changed by another request.', 409);
      }

      await manager.query(
        `UPDATE visual_directions
         SET name = $2, rationale = $3, mood_keywords = $4::jsonb, imagery = $5::jsonb,
             layout_notes = $6::jsonb, origin = 'USER', updated_at = now(), lock_version = lock_version + 1
         WHERE id = $1`,
        [
          directionId,
          dto.name.trim(),
          normalizeText(dto.rationale),
          JSON.stringify(dto.moodKeywords ?? []),
          JSON.stringify(dto.imagery ?? []),
          JSON.stringify(dto.layoutNotes ?? [])
        ]
      );
      await this.replaceChildren(manager, directionId, dto.colors ?? [], dto.fonts ?? []);

      if (direction.is_selected) {
        await this.markAssetStagesStale(manager, versionId);
      }

      return this.readAggregate(directionId, versionId, manager);
    });
  }

  async select(workspaceId: string, projectId: string, versionId: string, directionId: string, dto: SelectVisualDirectionDto) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    await this.assertStrategyComplete(versionId);

    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<VisualDirectionRow[]>(
        `SELECT * FROM visual_directions WHERE id = $1 AND identity_version_id = $2 AND status = 'ACTIVE' FOR UPDATE`,
        [directionId, versionId]
      );
      const direction = rows[0];

      if (!direction) throw new DomainError('VISUAL_DIRECTION_NOT_FOUND', 'Visual direction was not found.', 404);
      if (direction.lock_version !== dto.lockVersion) {
        throw new DomainError('VISUAL_DIRECTION_UPDATE_CONFLICT', 'Visual direction was changed by another request.', 409);
      }

      await manager.query(
        `UPDATE visual_directions SET is_selected = false, selected_at = NULL, updated_at = now()
         WHERE identity_version_id = $1 AND is_selected`,
        [versionId]
      );
      await manager.query(
        `UPDATE visual_directions
         SET is_selected = true, selected_at = now(), updated_at = now(), lock_version = lock_version + 1
         WHERE id = $1`,
        [directionId]
      );
      await manager.query(
        `UPDATE workflow_stages
         SET status = $1, completion_percent = 100, updated_at = now()
         WHERE identity_version_id = $2 AND stage_key = $3`,
        [WorkflowStageStatus.Completed, versionId, WorkflowStageKey.Visuals]
      );
      await manager.query(
        `UPDATE workflow_stages
         SET status = $1, updated_at = now()
         WHERE identity_version_id = $2 AND stage_key = $3 AND status = $4`,
        [WorkflowStageStatus.NotStarted, versionId, WorkflowStageKey.Assets, WorkflowStageStatus.Locked]
      );
      await this.markAssetStagesStale(manager, versionId);
      return this.readAggregate(directionId, versionId, manager);
    });
  }

  async archive(workspaceId: string, projectId: string, versionId: string, directionId: string, lockVersion: number) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);

    const rows = await this.dataSource.query<VisualDirectionRow[]>(
      `UPDATE visual_directions
       SET status = 'ARCHIVED', is_selected = false, archived_at = now(), updated_at = now(), lock_version = lock_version + 1
       WHERE id = $1 AND identity_version_id = $2 AND lock_version = $3 AND status = 'ACTIVE'
       RETURNING *`,
      [directionId, versionId, lockVersion]
    );

    if (!rows[0]) throw new DomainError('VISUAL_DIRECTION_UPDATE_CONFLICT', 'Visual direction was changed by another request.', 409);
    return { ok: true };
  }

  private async replaceChildren(
    manager: Pick<DataSource['manager'], 'query'>,
    directionId: string,
    colors: VisualColorDto[],
    fonts: VisualFontDto[]
  ) {
    await manager.query(`DELETE FROM visual_colors WHERE visual_direction_id = $1`, [directionId]);
    await manager.query(`DELETE FROM visual_fonts WHERE visual_direction_id = $1`, [directionId]);

    for (const [index, color] of colors.entries()) {
      const metrics = deriveColorMetrics(color.hex);
      await manager.query(
        `INSERT INTO visual_colors (
          visual_direction_id, token_name, name, hex, rgb, hsl, usage,
          contrast_on_white, contrast_on_black, origin, sort_order
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11)`,
        [
          directionId,
          color.tokenName.trim().toLowerCase(),
          color.name.trim(),
          metrics.hex,
          JSON.stringify(metrics.rgb),
          JSON.stringify(metrics.hsl),
          normalizeText(color.usage),
          metrics.contrastOnWhite,
          metrics.contrastOnBlack,
          color.origin ?? 'USER',
          color.sortOrder ?? index
        ]
      );
    }

    for (const [index, font] of fonts.entries()) {
      await manager.query(
        `INSERT INTO visual_fonts (
          visual_direction_id, role, family, fallback, weights, supported_scripts,
          source, license_status, origin, sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          directionId,
          validateFontRole(font.role),
          font.family.trim(),
          font.fallback.trim(),
          validateFontWeights(font.weights ?? [400]),
          font.supportedScripts ?? [],
          font.source ?? 'SYSTEM',
          font.licenseStatus ?? 'UNKNOWN',
          font.origin ?? 'USER',
          font.sortOrder ?? index
        ]
      );
    }
  }

  private async readAggregate(directionId: string, versionId: string, manager: Pick<DataSource['manager'], 'query'> = this.dataSource) {
    const [directionRows, colors, fonts] = await Promise.all([
      manager.query(`SELECT * FROM visual_directions WHERE id = $1 AND identity_version_id = $2 AND status = 'ACTIVE'`, [
        directionId,
        versionId
      ]),
      manager.query(`SELECT * FROM visual_colors WHERE visual_direction_id = $1 ORDER BY sort_order ASC, id ASC`, [directionId]),
      manager.query(`SELECT * FROM visual_fonts WHERE visual_direction_id = $1 ORDER BY sort_order ASC, id ASC`, [directionId])
    ]);

    if (!directionRows[0]) throw new DomainError('VISUAL_DIRECTION_NOT_FOUND', 'Visual direction was not found.', 404);
    return { direction: directionRows[0], colors, fonts };
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

  private async assertStrategyComplete(versionId: string) {
    const rows = await this.dataSource.query(
      `SELECT workflow_stages.status
       FROM workflow_stages
       WHERE identity_version_id = $1 AND stage_key = 'STRATEGY'`,
      [versionId]
    );

    if (rows[0]?.status !== WorkflowStageStatus.Completed) {
      throw new DomainError('STRATEGY_NOT_COMPLETE', 'Complete Strategy before editing Visuals.', 409);
    }
  }

  private async markAssetStagesStale(manager: Pick<DataSource['manager'], 'query'>, versionId: string) {
    await manager.query(
      `UPDATE workflow_stages
       SET status = $1, stale_reason = 'Selected visual direction changed.', updated_at = now()
       WHERE identity_version_id = $2 AND stage_key IN ('ASSETS', 'FINALIZE') AND status IN ('GENERATING', 'READY', 'COMPLETED')`,
      [WorkflowStageStatus.Stale, versionId]
    );
  }
}

function normalizeText(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
