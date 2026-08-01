import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DomainError } from '../common/domain-error';
import { WorkflowStageKey, WorkflowStageStatus } from '../database/entities';
import { calculateBriefCompletion } from './brief-completion';
import type {
  BriefLanguageDto,
  BriefMarketDto,
  CompleteBriefDto,
  NamedBriefItemDto,
  TextBriefItemDto,
  UpdateBriefDto
} from './dto/brief.dto';

export interface BriefRow {
  id: string;
  identity_version_id: string;
  industry: string | null;
  positioning: string | null;
  completion_percent: number;
  completion_reasons: string[];
  confirmed_at: Date | null;
  lock_version: number;
}

interface BriefLanguageRow {
  is_primary?: boolean;
}

export interface BriefAggregateResponse {
  brief: BriefRow | undefined;
  languages: BriefLanguageRow[];
  audiences: unknown[];
  markets: unknown[];
  offerings: unknown[];
  preferences: unknown[];
  constraints: unknown[];
}

type ChildTable =
  | 'brand_brief_languages'
  | 'brand_brief_audiences'
  | 'brand_brief_markets'
  | 'brand_brief_offerings'
  | 'brand_brief_preferences'
  | 'brand_brief_constraints';

export const updateBriefCompletionSql = `
  UPDATE brand_briefs
  SET completion_percent = $1::smallint, completion_reasons = $2::jsonb,
      confirmed_by_user_id = CASE WHEN $1::smallint = 100 THEN confirmed_by_user_id ELSE NULL END,
      confirmed_at = CASE WHEN $1::smallint = 100 THEN confirmed_at ELSE NULL END
  WHERE id = $3
`;

@Injectable()
export class BriefsService {
  constructor(private readonly dataSource: DataSource) {}

  async get(workspaceId: string, projectId: string, versionId: string): Promise<BriefAggregateResponse> {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const brief = await this.ensureBrief(versionId);
    return this.readAggregate(brief.id);
  }

  async update(
    workspaceId: string,
    projectId: string,
    versionId: string,
    dto: UpdateBriefDto
  ): Promise<BriefAggregateResponse> {
    await this.assertVersionAccess(workspaceId, projectId, versionId);

    const aggregate = await this.dataSource.transaction(async (manager) => {
      const brief = await this.ensureBrief(versionId);
      const lockedRows = await manager.query<BriefRow[]>(`SELECT * FROM brand_briefs WHERE id = $1 FOR UPDATE`, [brief.id]);
      const locked = lockedRows[0];

      if (!locked) {
        throw new DomainError('BRIEF_NOT_FOUND', 'Brief was not found.', 404);
      }

      if (locked.lock_version !== dto.lockVersion) {
        throw new DomainError('BRIEF_UPDATE_CONFLICT', 'Brief was changed by another request.', 409);
      }

      if (dto.industry !== undefined || dto.positioning !== undefined) {
        await manager.query(
          `UPDATE brand_briefs
           SET industry = CASE WHEN $4 THEN $1 ELSE industry END,
               positioning = CASE WHEN $5 THEN $2 ELSE positioning END,
               origin = 'USER',
               updated_at = now(),
               lock_version = lock_version + 1
           WHERE id = $3`,
          [
            normalizeText(dto.industry),
            normalizeText(dto.positioning),
            brief.id,
            dto.industry !== undefined,
            dto.positioning !== undefined
          ]
        );
      } else {
        await manager.query(`UPDATE brand_briefs SET updated_at = now(), lock_version = lock_version + 1 WHERE id = $1`, [
          brief.id
        ]);
      }

      if (dto.languages) {
        await this.replaceLanguages(manager, brief.id, dto.languages);
      }
      if (dto.audiences) {
        await this.replaceNamedItems(manager, 'brand_brief_audiences', brief.id, dto.audiences);
      }
      if (dto.markets) {
        await this.replaceMarkets(manager, brief.id, dto.markets);
      }
      if (dto.offerings) {
        await this.replaceNamedItems(manager, 'brand_brief_offerings', brief.id, dto.offerings);
      }
      if (dto.preferences) {
        await this.replaceTextItems(manager, 'brand_brief_preferences', brief.id, dto.preferences);
      }
      if (dto.constraints) {
        await this.replaceTextItems(manager, 'brand_brief_constraints', brief.id, dto.constraints);
      }

      await this.recalculateCompletion(manager, brief.id);

      if (locked.confirmed_at) {
        await this.markDownstreamStale(manager, versionId);
      }

      return this.readAggregate(brief.id, manager);
    });

    return aggregate;
  }

  async complete(
    workspaceId: string,
    projectId: string,
    versionId: string,
    userId: string,
    dto: CompleteBriefDto
  ): Promise<BriefAggregateResponse> {
    await this.assertVersionAccess(workspaceId, projectId, versionId);

    return this.dataSource.transaction(async (manager) => {
      const brief = await this.ensureBrief(versionId);
      const aggregate = await this.readAggregate(brief.id, manager);
      const row = aggregate.brief as BriefRow;

      if (row.lock_version !== dto.lockVersion) {
        throw new DomainError('BRIEF_UPDATE_CONFLICT', 'Brief was changed by another request.', 409);
      }

      const completion = calculateBriefCompletion({
        industry: row.industry,
        positioning: row.positioning,
        languages: aggregate.languages,
        primaryLanguageCount: aggregate.languages.filter((item: BriefLanguageRow) => Boolean(item.is_primary)).length,
        audiences: aggregate.audiences,
        markets: aggregate.markets,
        offerings: aggregate.offerings,
        preferences: aggregate.preferences,
        constraints: aggregate.constraints
      });

      if (!completion.complete) {
        throw new DomainError('BRIEF_INCOMPLETE', 'Brief is missing required fields.', 422, completion.reasons);
      }

      await manager.query(
        `UPDATE brand_briefs
         SET completion_percent = 100, completion_reasons = '[]'::jsonb, confirmed_by_user_id = $1,
             confirmed_at = now(), updated_at = now(), lock_version = lock_version + 1
         WHERE id = $2`,
        [userId, brief.id]
      );
      await manager.query(
        `UPDATE workflow_stages
         SET status = $1, completion_percent = 100, confirmed_by_user_id = $2, confirmed_at = now(), updated_at = now()
         WHERE identity_version_id = $3 AND stage_key = $4`,
        [WorkflowStageStatus.Completed, userId, versionId, WorkflowStageKey.Brief]
      );
      await manager.query(
        `UPDATE workflow_stages
         SET status = $1, updated_at = now()
         WHERE identity_version_id = $2 AND stage_key = $3 AND status = $4`,
        [WorkflowStageStatus.NotStarted, versionId, WorkflowStageKey.Strategy, WorkflowStageStatus.Locked]
      );

      return this.readAggregate(brief.id, manager);
    });
  }

  private async assertVersionAccess(workspaceId: string, projectId: string, versionId: string) {
    const rows = await this.dataSource.query(
      `SELECT identity_versions.id
       FROM identity_versions
       JOIN identity_projects ON identity_projects.id = identity_versions.identity_project_id
       WHERE identity_versions.id = $1
         AND identity_projects.id = $2
         AND identity_projects.workspace_id = $3
         AND identity_projects.status = 'ACTIVE'`,
      [versionId, projectId, workspaceId]
    );

    if (!rows[0]) {
      throw new DomainError('IDENTITY_VERSION_NOT_FOUND', 'Identity version was not found.', 404);
    }
  }

  private async ensureBrief(versionId: string): Promise<BriefRow> {
    const rows = await this.dataSource.query<BriefRow[]>(
      `INSERT INTO brand_briefs (identity_version_id)
       VALUES ($1)
       ON CONFLICT (identity_version_id) DO UPDATE SET identity_version_id = EXCLUDED.identity_version_id
       RETURNING *`,
      [versionId]
    );

    return rows[0] as BriefRow;
  }

  private async readAggregate(
    briefId: string,
    manager: Pick<DataSource['manager'], 'query'> = this.dataSource
  ): Promise<BriefAggregateResponse> {
    const [briefRows, languages, audiences, markets, offerings, preferences, constraints] = await Promise.all([
      manager.query<BriefRow[]>(`SELECT * FROM brand_briefs WHERE id = $1`, [briefId]),
      this.readChildren(manager, 'brand_brief_languages', briefId),
      this.readChildren(manager, 'brand_brief_audiences', briefId),
      this.readChildren(manager, 'brand_brief_markets', briefId),
      this.readChildren(manager, 'brand_brief_offerings', briefId),
      this.readChildren(manager, 'brand_brief_preferences', briefId),
      this.readChildren(manager, 'brand_brief_constraints', briefId)
    ]);

    const brief = briefRows[0] as BriefRow;
    const completion = calculateBriefCompletion({
      industry: brief.industry,
      positioning: brief.positioning,
      languages,
      primaryLanguageCount: languages.filter((item: BriefLanguageRow) => Boolean(item.is_primary)).length,
      audiences,
      markets,
      offerings,
      preferences,
      constraints
    });

    return {
      // Recompute on read so older AI jobs created before a completion-rule
      // change do not remain visibly stuck at a stale percentage.
      brief: { ...brief, completion_percent: completion.completionPercent, completion_reasons: completion.reasons },
      languages,
      audiences,
      markets,
      offerings,
      preferences,
      constraints
    };
  }

  private readChildren(manager: Pick<DataSource['manager'], 'query'>, table: ChildTable, briefId: string) {
    return manager.query(`SELECT * FROM ${table} WHERE brand_brief_id = $1 ORDER BY sort_order ASC, id ASC`, [briefId]);
  }

  private async replaceLanguages(manager: Pick<DataSource['manager'], 'query'>, briefId: string, items: BriefLanguageDto[]) {
    await manager.query(`DELETE FROM brand_brief_languages WHERE brand_brief_id = $1`, [briefId]);

    for (const [index, item] of items.entries()) {
      await manager.query(
        `INSERT INTO brand_brief_languages (id, brand_brief_id, language_code, display_name, is_primary, origin, sort_order)
         VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7)`,
        [
          item.id ?? null,
          briefId,
          item.languageCode.trim(),
          item.displayName.trim(),
          item.isPrimary ?? false,
          item.origin ?? 'USER',
          item.sortOrder ?? index
        ]
      );
    }
  }

  private async replaceMarkets(manager: Pick<DataSource['manager'], 'query'>, briefId: string, items: BriefMarketDto[]) {
    await manager.query(`DELETE FROM brand_brief_markets WHERE brand_brief_id = $1`, [briefId]);

    for (const [index, item] of items.entries()) {
      await manager.query(
        `INSERT INTO brand_brief_markets (id, brand_brief_id, name, region, origin, sort_order)
         VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6)`,
        [item.id ?? null, briefId, item.name.trim(), normalizeText(item.region), item.origin ?? 'USER', item.sortOrder ?? index]
      );
    }
  }

  private async replaceNamedItems(
    manager: Pick<DataSource['manager'], 'query'>,
    table: 'brand_brief_audiences' | 'brand_brief_offerings',
    briefId: string,
    items: NamedBriefItemDto[]
  ) {
    await manager.query(`DELETE FROM ${table} WHERE brand_brief_id = $1`, [briefId]);

    for (const [index, item] of items.entries()) {
      await manager.query(
        `INSERT INTO ${table} (id, brand_brief_id, name, description, origin, sort_order)
         VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6)`,
        [
          item.id ?? null,
          briefId,
          item.name.trim(),
          normalizeText(item.description),
          item.origin ?? 'USER',
          item.sortOrder ?? index
        ]
      );
    }
  }

  private async replaceTextItems(
    manager: Pick<DataSource['manager'], 'query'>,
    table: 'brand_brief_preferences' | 'brand_brief_constraints',
    briefId: string,
    items: TextBriefItemDto[]
  ) {
    await manager.query(`DELETE FROM ${table} WHERE brand_brief_id = $1`, [briefId]);

    for (const [index, item] of items.entries()) {
      await manager.query(
        `INSERT INTO ${table} (id, brand_brief_id, text, origin, sort_order)
         VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5)`,
        [item.id ?? null, briefId, item.text.trim(), item.origin ?? 'USER', item.sortOrder ?? index]
      );
    }
  }

  private async recalculateCompletion(manager: Pick<DataSource['manager'], 'query'>, briefId: string): Promise<void> {
    const aggregate = await this.readAggregate(briefId, manager);
    const brief = aggregate.brief as BriefRow;
    const completion = calculateBriefCompletion({
      industry: brief.industry,
      positioning: brief.positioning,
      languages: aggregate.languages,
      primaryLanguageCount: aggregate.languages.filter((item: BriefLanguageRow) => Boolean(item.is_primary)).length,
      audiences: aggregate.audiences,
      markets: aggregate.markets,
      offerings: aggregate.offerings,
      preferences: aggregate.preferences,
      constraints: aggregate.constraints
    });

    await manager.query(
      updateBriefCompletionSql,
      [completion.completionPercent, JSON.stringify(completion.reasons), briefId]
    );
  }

  private async markDownstreamStale(manager: Pick<DataSource['manager'], 'query'>, versionId: string): Promise<void> {
    await manager.query(
      `UPDATE workflow_stages
       SET status = $1, stale_reason = 'Brief changed after confirmation.', updated_at = now()
       WHERE identity_version_id = $2
         AND stage_key IN ('STRATEGY', 'VISUALS', 'ASSETS', 'FINALIZE')
         AND status IN ('GENERATING', 'READY', 'COMPLETED')`,
      [WorkflowStageStatus.Stale, versionId]
    );
  }
}

function normalizeText(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
