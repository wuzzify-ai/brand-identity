import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DomainError } from '../common/domain-error';
import type { LogoConceptActionDto, UpdateLogoConceptDto } from './dto/logo-concept.dto';

type LogoConceptStatus = 'DRAFT' | 'SHORTLISTED' | 'SELECTED' | 'REJECTED' | 'ARCHIVED';

@Injectable()
export class LogoConceptsService {
  constructor(private readonly dataSource: DataSource) {}

  async list(workspaceId: string, projectId: string, versionId: string) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    return this.dataSource.query(
      `SELECT logo_concepts.*,
              COALESCE(
                jsonb_agg(to_jsonb(brand_assets) ORDER BY logo_concept_assets.sort_order)
                FILTER (WHERE brand_assets.id IS NOT NULL),
                '[]'::jsonb
              ) AS assets
       FROM logo_concepts
       LEFT JOIN logo_concept_assets ON logo_concept_assets.logo_concept_id = logo_concepts.id
       LEFT JOIN brand_assets ON brand_assets.id = logo_concept_assets.brand_asset_id AND brand_assets.status <> 'ARCHIVED'
       WHERE logo_concepts.identity_version_id = $1 AND logo_concepts.status <> 'ARCHIVED'
       GROUP BY logo_concepts.id
       ORDER BY logo_concepts.status = 'SELECTED' DESC, logo_concepts.updated_at DESC`,
      [versionId]
    );
  }

  async get(workspaceId: string, projectId: string, versionId: string, conceptId: string) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    return this.readAggregate(versionId, conceptId);
  }

  async update(workspaceId: string, projectId: string, versionId: string, conceptId: string, dto: UpdateLogoConceptDto) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const rows = await this.dataSource.query(
      `UPDATE logo_concepts
       SET production_notes = COALESCE($3, production_notes), metadata = COALESCE($4::jsonb, metadata),
           updated_at = now(), lock_version = lock_version + 1
       WHERE id = $1 AND identity_version_id = $2 AND lock_version = $5 AND status <> 'ARCHIVED'
       RETURNING *`,
      [conceptId, versionId, normalizeText(dto.productionNotes), dto.metadata ? JSON.stringify(dto.metadata) : null, dto.lockVersion]
    );
    if (!rows[0]) throw new DomainError('LOGO_CONCEPT_UPDATE_CONFLICT', 'Logo concept was changed by another request.', 409);
    return this.readAggregate(versionId, conceptId);
  }

  shortlist(workspaceId: string, projectId: string, versionId: string, conceptId: string, dto: LogoConceptActionDto) {
    return this.changeStatus(workspaceId, projectId, versionId, conceptId, dto, 'SHORTLISTED');
  }

  reject(workspaceId: string, projectId: string, versionId: string, conceptId: string, dto: LogoConceptActionDto) {
    return this.changeStatus(workspaceId, projectId, versionId, conceptId, dto, 'REJECTED');
  }

  archive(workspaceId: string, projectId: string, versionId: string, conceptId: string, lockVersion: number) {
    return this.changeStatus(workspaceId, projectId, versionId, conceptId, { lockVersion }, 'ARCHIVED');
  }

  async select(workspaceId: string, projectId: string, versionId: string, conceptId: string, dto: LogoConceptActionDto) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(`SELECT * FROM logo_concepts WHERE id = $1 AND identity_version_id = $2 AND status <> 'ARCHIVED' FOR UPDATE`, [
        conceptId,
        versionId
      ]);
      const concept = rows[0];
      if (!concept) throw new DomainError('LOGO_CONCEPT_NOT_FOUND', 'Logo concept was not found.', 404);
      if (concept.lock_version !== dto.lockVersion) {
        throw new DomainError('LOGO_CONCEPT_UPDATE_CONFLICT', 'Logo concept was changed by another request.', 409);
      }

      await manager.query(
        `UPDATE logo_concepts
         SET status = CASE WHEN status = 'SELECTED' THEN 'SHORTLISTED' ELSE status END,
             selected_at = NULL, updated_at = now()
         WHERE identity_version_id = $1 AND status = 'SELECTED'`,
        [versionId]
      );
      await manager.query(
        `UPDATE logo_concepts
         SET status = 'SELECTED', selected_at = now(), updated_at = now(), lock_version = lock_version + 1
         WHERE id = $1`,
        [conceptId]
      );
    });

    return this.readAggregate(versionId, conceptId);
  }

  private async changeStatus(
    workspaceId: string,
    projectId: string,
    versionId: string,
    conceptId: string,
    dto: LogoConceptActionDto,
    status: LogoConceptStatus
  ) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const rows = await this.dataSource.query(
      `UPDATE logo_concepts
       SET status = $3::logo_concept_status,
           archived_at = CASE WHEN $3::logo_concept_status = 'ARCHIVED'::logo_concept_status THEN now() ELSE archived_at END,
           updated_at = now(), lock_version = lock_version + 1
       WHERE id = $1 AND identity_version_id = $2 AND lock_version = $4::integer AND status <> 'ARCHIVED'::logo_concept_status
       RETURNING *`,
      [conceptId, versionId, status, dto.lockVersion]
    );
    if (!rows[0]) throw new DomainError('LOGO_CONCEPT_UPDATE_CONFLICT', 'Logo concept was changed by another request.', 409);
    return this.readAggregate(versionId, conceptId);
  }

  private async readAggregate(versionId: string, conceptId: string) {
    const [conceptRows, assets] = await Promise.all([
      this.dataSource.query(`SELECT * FROM logo_concepts WHERE id = $1 AND identity_version_id = $2 AND status <> 'ARCHIVED'`, [
        conceptId,
        versionId
      ]),
      this.dataSource.query(
        `SELECT brand_assets.*
         FROM logo_concept_assets
         JOIN brand_assets ON brand_assets.id = logo_concept_assets.brand_asset_id
         WHERE logo_concept_assets.logo_concept_id = $1 AND brand_assets.status <> 'ARCHIVED'
         ORDER BY logo_concept_assets.sort_order`,
        [conceptId]
      )
    ]);
    if (!conceptRows[0]) throw new DomainError('LOGO_CONCEPT_NOT_FOUND', 'Logo concept was not found.', 404);
    return { concept: conceptRows[0], assets };
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

function normalizeText(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
