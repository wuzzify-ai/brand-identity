import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { DomainError } from '../common/domain-error';
import type { CloneIdentityVersionDto, CreateIdentityProjectDto, UpdateIdentityProjectDto } from './dto/identity-project.dto';
import { createDefaultWorkflowStages, slugifyProjectName } from './workflow-stage.factory';

@Injectable()
export class IdentityProjectsService {
  constructor(private readonly dataSource: DataSource) {}

  async create(workspaceId: string, userId: string, dto: CreateIdentityProjectDto) {
    const slug = dto.slug ?? slugifyProjectName(dto.name);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const projectRows = await manager.query<{ id: string }[]>(
          `INSERT INTO identity_projects (workspace_id, parent_project_id, created_by_user_id, name, slug, metadata)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)
           RETURNING *`,
          [
            workspaceId,
            dto.parentProjectId ?? null,
            userId,
            dto.name.trim(),
            slug,
            JSON.stringify({ initialDescription: dto.initialDescription ?? null })
          ]
        );
        const project = projectRows[0];
        const versionRows = await manager.query<{ id: string }[]>(
          `INSERT INTO identity_versions (identity_project_id, version_number, created_by_user_id)
           VALUES ($1, 1, $2)
           RETURNING *`,
          [project?.id, userId]
        );
        const version = versionRows[0];

        for (const stage of createDefaultWorkflowStages()) {
          await manager.query(
            `INSERT INTO workflow_stages (identity_version_id, stage_key, status, completion_percent)
             VALUES ($1, $2, $3, $4)`,
            [version?.id, stage.stageKey, stage.status, stage.completionPercent]
          );
        }

        return {
          project,
          version,
          stages: await this.versionStages(manager, version?.id as string)
        };
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new DomainError('IDENTITY_PROJECT_CONFLICT', 'A project with this slug already exists.', 409);
      }

      throw error;
    }
  }

  list(workspaceId: string, query: { status?: string; parentProjectId?: string; limit?: number; offset?: number }) {
    const values: unknown[] = [workspaceId];
    const filters = [`workspace_id = $1`];

    if (query.status) {
      values.push(query.status);
      filters.push(`status = $${values.length}`);
    } else {
      filters.push(`status = 'ACTIVE'`);
    }

    if (query.parentProjectId) {
      values.push(query.parentProjectId);
      filters.push(`parent_project_id = $${values.length}`);
    }

    values.push(Math.min(Math.max(query.limit ?? 25, 1), 100));
    const limitIndex = values.length;
    values.push(Math.max(query.offset ?? 0, 0));
    const offsetIndex = values.length;

    return this.dataSource.query(
      `SELECT *
       FROM identity_projects
       WHERE ${filters.join(' AND ')}
       ORDER BY updated_at DESC, id DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values
    );
  }

  async get(workspaceId: string, projectId: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM identity_projects WHERE workspace_id = $1 AND id = $2 AND status = 'ACTIVE'`,
      [workspaceId, projectId]
    );
    const project = rows[0];

    if (!project) {
      throw new DomainError('IDENTITY_PROJECT_NOT_FOUND', 'Identity project was not found.', 404);
    }

    return project;
  }

  async update(workspaceId: string, projectId: string, dto: UpdateIdentityProjectDto) {
    const values: unknown[] = [];
    const sets: string[] = [];

    if (dto.name !== undefined) {
      values.push(dto.name.trim());
      sets.push(`name = $${values.length}`);
    }

    if (dto.slug !== undefined) {
      values.push(dto.slug);
      sets.push(`slug = $${values.length}`);
    }

    if (sets.length === 0) {
      return this.get(workspaceId, projectId);
    }

    values.push(dto.lockVersion, workspaceId, projectId);
    const lockIndex = values.length - 2;
    const workspaceIndex = values.length - 1;
    const projectIndex = values.length;

    try {
      const rows = await this.dataSource.query(
        `UPDATE identity_projects
         SET ${sets.join(', ')}, updated_at = now(), lock_version = lock_version + 1
         WHERE lock_version = $${lockIndex} AND workspace_id = $${workspaceIndex} AND id = $${projectIndex} AND status = 'ACTIVE'
         RETURNING *`,
        values
      );

      if (!rows[0]) {
        throw new DomainError('IDENTITY_PROJECT_UPDATE_CONFLICT', 'Project was changed by another request.', 409);
      }

      return rows[0];
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new DomainError('IDENTITY_PROJECT_CONFLICT', 'A project with this slug already exists.', 409);
      }

      throw error;
    }
  }

  async archive(workspaceId: string, projectId: string, lockVersion: number) {
    const rows = await this.dataSource.query(
      `UPDATE identity_projects
       SET status = 'ARCHIVED', archived_at = now(), updated_at = now(), lock_version = lock_version + 1
       WHERE workspace_id = $1 AND id = $2 AND lock_version = $3 AND status = 'ACTIVE'
       RETURNING id`,
      [workspaceId, projectId, lockVersion]
    );

    if (!rows[0]) {
      throw new DomainError('IDENTITY_PROJECT_UPDATE_CONFLICT', 'Project was changed by another request.', 409);
    }

    return { ok: true };
  }

  async versions(workspaceId: string, projectId: string) {
    await this.get(workspaceId, projectId);

    return this.dataSource.query(
      `SELECT identity_versions.*,
              COALESCE(json_agg(workflow_stages ORDER BY workflow_stages.created_at) FILTER (WHERE workflow_stages.id IS NOT NULL), '[]') AS stages
       FROM identity_versions
       LEFT JOIN workflow_stages ON workflow_stages.identity_version_id = identity_versions.id
       WHERE identity_versions.identity_project_id = $1
       GROUP BY identity_versions.id
       ORDER BY version_number DESC`,
      [projectId]
    );
  }

  async cloneDraft(workspaceId: string, projectId: string, userId: string, dto: CloneIdentityVersionDto) {
    await this.get(workspaceId, projectId);

    return this.dataSource.transaction(async (manager) => {
      const sourceRows = await manager.query<{ id: string; identity_project_id: string }[]>(
        `SELECT id, identity_project_id FROM identity_versions WHERE id = $1 AND identity_project_id = $2`,
        [dto.sourceVersionId, projectId]
      );

      if (!sourceRows[0]) {
        throw new DomainError('IDENTITY_VERSION_NOT_FOUND', 'Identity version was not found.', 404);
      }

      const versionRows = await manager.query<{ id: string }[]>(
        `INSERT INTO identity_versions (identity_project_id, version_number, source_version_id, created_by_user_id)
         SELECT $1, COALESCE(max(version_number), 0) + 1, $2, $3
         FROM identity_versions
         WHERE identity_project_id = $1
         RETURNING *`,
        [projectId, dto.sourceVersionId, userId]
      );
      const version = versionRows[0];

      for (const stage of createDefaultWorkflowStages()) {
        await manager.query(
          `INSERT INTO workflow_stages (identity_version_id, stage_key, status, completion_percent)
           VALUES ($1, $2, $3, $4)`,
          [version?.id, stage.stageKey, stage.status, stage.completionPercent]
        );
      }

      return {
        version,
        stages: await this.versionStages(manager, version?.id as string)
      };
    });
  }

  private versionStages(manager: Pick<DataSource['manager'], 'query'>, versionId: string) {
    return manager.query(
      `SELECT stage_key, status, completion_percent, stale_reason, updated_at
       FROM workflow_stages
       WHERE identity_version_id = $1
       ORDER BY CASE stage_key
         WHEN 'BRIEF' THEN 1
         WHEN 'STRATEGY' THEN 2
         WHEN 'VISUALS' THEN 3
         WHEN 'ASSETS' THEN 4
         WHEN 'FINALIZE' THEN 5
       END`,
      [versionId]
    );
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof QueryFailedError && (error as QueryFailedError & { code?: string }).code === '23505';
  }
}
