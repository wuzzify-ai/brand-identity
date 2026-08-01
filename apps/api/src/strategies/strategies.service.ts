import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DomainError } from '../common/domain-error';
import { WorkflowStageKey, WorkflowStageStatus } from '../database/entities';
import { calculateStrategyCompletion } from './strategy-completion';
import type {
  CompleteStrategyDto,
  StrategyMessagingPillarDto,
  StrategyPersonaDto,
  StrategyTaglineDto,
  StrategyTextItemDto,
  UpdateStrategyDto
} from './dto/strategy.dto';

interface StrategyRow {
  id: string;
  identity_version_id: string;
  positioning: string | null;
  value_proposition: string | null;
  mission: string | null;
  vision: string | null;
  essence: string | null;
  promise: string | null;
  completion_percent: number;
  completion_reasons: string[];
  confirmed_at: Date | null;
  lock_version: number;
}

type ChildTable =
  | 'brand_strategy_values'
  | 'brand_strategy_personas'
  | 'brand_strategy_messaging_pillars'
  | 'brand_strategy_taglines'
  | 'brand_strategy_rules';

export interface StrategyAggregateResponse {
  strategy: StrategyRow | undefined;
  values: unknown[];
  personas: unknown[];
  messagingPillars: unknown[];
  taglines: unknown[];
  rules: unknown[];
}

@Injectable()
export class StrategiesService {
  constructor(private readonly dataSource: DataSource) {}

  async get(workspaceId: string, projectId: string, versionId: string): Promise<StrategyAggregateResponse> {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const strategy = await this.ensureStrategy(versionId);
    return this.readAggregate(strategy.id);
  }

  async update(
    workspaceId: string,
    projectId: string,
    versionId: string,
    dto: UpdateStrategyDto
  ): Promise<StrategyAggregateResponse> {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    await this.assertBriefComplete(versionId);

    return this.dataSource.transaction(async (manager) => {
      const strategy = await this.ensureStrategy(versionId);
      const lockedRows = await manager.query<StrategyRow[]>(`SELECT * FROM brand_strategies WHERE id = $1 FOR UPDATE`, [
        strategy.id
      ]);
      const locked = lockedRows[0];

      if (!locked) {
        throw new DomainError('STRATEGY_NOT_FOUND', 'Strategy was not found.', 404);
      }

      if (locked.lock_version !== dto.lockVersion) {
        throw new DomainError('STRATEGY_UPDATE_CONFLICT', 'Strategy was changed by another request.', 409);
      }

      await manager.query(
        `UPDATE brand_strategies
         SET positioning = CASE WHEN $2 THEN $3 ELSE positioning END,
             value_proposition = CASE WHEN $4 THEN $5 ELSE value_proposition END,
             mission = CASE WHEN $6 THEN $7 ELSE mission END,
             vision = CASE WHEN $8 THEN $9 ELSE vision END,
             essence = CASE WHEN $10 THEN $11 ELSE essence END,
             promise = CASE WHEN $12 THEN $13 ELSE promise END,
             origin = 'USER',
             updated_at = now(),
             lock_version = lock_version + 1
         WHERE id = $1`,
        [
          strategy.id,
          dto.positioning !== undefined,
          normalizeText(dto.positioning),
          dto.valueProposition !== undefined,
          normalizeText(dto.valueProposition),
          dto.mission !== undefined,
          normalizeText(dto.mission),
          dto.vision !== undefined,
          normalizeText(dto.vision),
          dto.essence !== undefined,
          normalizeText(dto.essence),
          dto.promise !== undefined,
          normalizeText(dto.promise)
        ]
      );

      if (dto.values) await this.replaceTextItems(manager, 'brand_strategy_values', strategy.id, dto.values, false);
      if (dto.rules) await this.replaceTextItems(manager, 'brand_strategy_rules', strategy.id, dto.rules, true);
      if (dto.taglines) await this.replaceTaglines(manager, strategy.id, dto.taglines);
      if (dto.personas) await this.replacePersonas(manager, strategy.id, dto.personas);
      if (dto.messagingPillars) await this.replaceMessagingPillars(manager, strategy.id, dto.messagingPillars);

      await this.recalculateCompletion(manager, strategy.id);

      if (locked.confirmed_at) {
        await this.markDownstreamStale(manager, versionId);
      }

      return this.readAggregate(strategy.id, manager);
    });
  }

  async complete(
    workspaceId: string,
    projectId: string,
    versionId: string,
    userId: string,
    dto: CompleteStrategyDto
  ): Promise<StrategyAggregateResponse> {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    await this.assertBriefComplete(versionId);

    return this.dataSource.transaction(async (manager) => {
      const strategy = await this.ensureStrategy(versionId);
      const aggregate = await this.readAggregate(strategy.id, manager);
      const row = aggregate.strategy;

      if (!row) {
        throw new DomainError('STRATEGY_NOT_FOUND', 'Strategy was not found.', 404);
      }

      if (row.lock_version !== dto.lockVersion) {
        throw new DomainError('STRATEGY_UPDATE_CONFLICT', 'Strategy was changed by another request.', 409);
      }

      const completion = await this.calculateAggregateCompletion(aggregate);

      if (!completion.complete) {
        throw new DomainError('STRATEGY_INCOMPLETE', 'Strategy is missing required fields.', 422, completion.reasons);
      }

      await manager.query(
        `UPDATE brand_strategies
         SET completion_percent = 100, completion_reasons = '[]'::jsonb, confirmed_by_user_id = $1,
             confirmed_at = now(), updated_at = now(), lock_version = lock_version + 1
         WHERE id = $2`,
        [userId, strategy.id]
      );
      await manager.query(
        `UPDATE workflow_stages
         SET status = $1, completion_percent = 100, confirmed_by_user_id = $2, confirmed_at = now(), updated_at = now()
         WHERE identity_version_id = $3 AND stage_key = $4`,
        [WorkflowStageStatus.Completed, userId, versionId, WorkflowStageKey.Strategy]
      );
      await manager.query(
        `UPDATE workflow_stages
         SET status = $1, updated_at = now()
         WHERE identity_version_id = $2 AND stage_key = $3 AND status = $4`,
        [WorkflowStageStatus.NotStarted, versionId, WorkflowStageKey.Visuals, WorkflowStageStatus.Locked]
      );

      return this.readAggregate(strategy.id, manager);
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

  private async assertBriefComplete(versionId: string): Promise<void> {
    const rows = await this.dataSource.query(
      `SELECT brand_briefs.confirmed_at, workflow_stages.status
       FROM brand_briefs
       JOIN workflow_stages ON workflow_stages.identity_version_id = brand_briefs.identity_version_id
       WHERE brand_briefs.identity_version_id = $1 AND workflow_stages.stage_key = 'BRIEF'`,
      [versionId]
    );

    if (!rows[0]?.confirmed_at || rows[0]?.status !== WorkflowStageStatus.Completed) {
      throw new DomainError('BRIEF_NOT_COMPLETE', 'Complete the Brief before editing Strategy.', 409);
    }
  }

  private async ensureStrategy(versionId: string): Promise<StrategyRow> {
    const rows = await this.dataSource.query<StrategyRow[]>(
      `INSERT INTO brand_strategies (identity_version_id)
       VALUES ($1)
       ON CONFLICT (identity_version_id) DO UPDATE SET identity_version_id = EXCLUDED.identity_version_id
       RETURNING *`,
      [versionId]
    );

    return rows[0] as StrategyRow;
  }

  private async readAggregate(
    strategyId: string,
    manager: Pick<DataSource['manager'], 'query'> = this.dataSource
  ): Promise<StrategyAggregateResponse> {
    const [strategyRows, values, personas, messagingPillars, taglines, rules] = await Promise.all([
      manager.query<StrategyRow[]>(`SELECT * FROM brand_strategies WHERE id = $1`, [strategyId]),
      this.readChildren(manager, 'brand_strategy_values', strategyId),
      this.readChildren(manager, 'brand_strategy_personas', strategyId),
      this.readChildren(manager, 'brand_strategy_messaging_pillars', strategyId),
      this.readChildren(manager, 'brand_strategy_taglines', strategyId),
      this.readChildren(manager, 'brand_strategy_rules', strategyId)
    ]);

    return { strategy: strategyRows[0], values, personas, messagingPillars, taglines, rules };
  }

  private readChildren(manager: Pick<DataSource['manager'], 'query'>, table: ChildTable, strategyId: string) {
    return manager.query(`SELECT * FROM ${table} WHERE brand_strategy_id = $1 ORDER BY sort_order ASC, id ASC`, [
      strategyId
    ]);
  }

  private async replaceTextItems(
    manager: Pick<DataSource['manager'], 'query'>,
    table: 'brand_strategy_values' | 'brand_strategy_rules',
    strategyId: string,
    items: StrategyTextItemDto[],
    hasLegalFlag: boolean
  ) {
    await manager.query(`DELETE FROM ${table} WHERE brand_strategy_id = $1`, [strategyId]);

    for (const [index, item] of items.entries()) {
      if (hasLegalFlag) {
        await manager.query(
          `INSERT INTO ${table} (id, brand_strategy_id, text, legal_review_required, origin, sort_order)
           VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6)`,
          [item.id ?? null, strategyId, item.text.trim(), item.legalReviewRequired ?? false, item.origin ?? 'USER', item.sortOrder ?? index]
        );
      } else {
        await manager.query(
          `INSERT INTO ${table} (id, brand_strategy_id, text, origin, sort_order)
           VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5)`,
          [item.id ?? null, strategyId, item.text.trim(), item.origin ?? 'USER', item.sortOrder ?? index]
        );
      }
    }
  }

  private async replaceTaglines(manager: Pick<DataSource['manager'], 'query'>, strategyId: string, items: StrategyTaglineDto[]) {
    await manager.query(`DELETE FROM brand_strategy_taglines WHERE brand_strategy_id = $1`, [strategyId]);

    for (const [index, item] of items.entries()) {
      await manager.query(
        `INSERT INTO brand_strategy_taglines (
          id, brand_strategy_id, text, language_code, is_selected, legal_review_required, origin, sort_order
        )
        VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8)`,
        [
          item.id ?? null,
          strategyId,
          item.text.trim(),
          item.languageCode ?? 'en',
          item.isSelected ?? false,
          item.legalReviewRequired ?? false,
          item.origin ?? 'USER',
          item.sortOrder ?? index
        ]
      );
    }
  }

  private async replacePersonas(manager: Pick<DataSource['manager'], 'query'>, strategyId: string, items: StrategyPersonaDto[]) {
    await manager.query(`DELETE FROM brand_strategy_personas WHERE brand_strategy_id = $1`, [strategyId]);

    for (const [index, item] of items.entries()) {
      await manager.query(
        `INSERT INTO brand_strategy_personas (id, brand_strategy_id, name, segment, needs, pains, origin, sort_order)
         VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
        [
          item.id ?? null,
          strategyId,
          item.name.trim(),
          normalizeText(item.segment),
          JSON.stringify(item.needs ?? []),
          JSON.stringify(item.pains ?? []),
          item.origin ?? 'USER',
          item.sortOrder ?? index
        ]
      );
    }
  }

  private async replaceMessagingPillars(
    manager: Pick<DataSource['manager'], 'query'>,
    strategyId: string,
    items: StrategyMessagingPillarDto[]
  ) {
    await manager.query(`DELETE FROM brand_strategy_messaging_pillars WHERE brand_strategy_id = $1`, [strategyId]);

    for (const [index, item] of items.entries()) {
      await manager.query(
        `INSERT INTO brand_strategy_messaging_pillars (id, brand_strategy_id, title, message, proof_points, origin, sort_order)
         VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5::jsonb, $6, $7)`,
        [
          item.id ?? null,
          strategyId,
          item.title.trim(),
          item.message.trim(),
          JSON.stringify(item.proofPoints ?? []),
          item.origin ?? 'USER',
          item.sortOrder ?? index
        ]
      );
    }
  }

  private async recalculateCompletion(manager: Pick<DataSource['manager'], 'query'>, strategyId: string): Promise<void> {
    const aggregate = await this.readAggregate(strategyId, manager);
    const completion = await this.calculateAggregateCompletion(aggregate);

    await manager.query(
      `UPDATE brand_strategies
       SET completion_percent = $1::smallint, completion_reasons = $2::jsonb,
           confirmed_by_user_id = CASE WHEN $1::smallint = 100 THEN confirmed_by_user_id ELSE NULL END,
           confirmed_at = CASE WHEN $1::smallint = 100 THEN confirmed_at ELSE NULL END
       WHERE id = $3`,
      [completion.completionPercent, JSON.stringify(completion.reasons), strategyId]
    );
  }

  private async calculateAggregateCompletion(aggregate: StrategyAggregateResponse) {
    const selectedTaglineCount = (aggregate.taglines as Array<{ is_selected?: boolean }>).filter((item) =>
      Boolean(item.is_selected)
    ).length;
    const strategy = aggregate.strategy;

    return calculateStrategyCompletion({
      positioning: strategy?.positioning ?? null,
      valueProposition: strategy?.value_proposition ?? null,
      mission: strategy?.mission ?? null,
      vision: strategy?.vision ?? null,
      values: aggregate.values,
      personas: aggregate.personas,
      messagingPillars: aggregate.messagingPillars,
      taglines: aggregate.taglines,
      selectedTaglineCount,
      rules: aggregate.rules
    });
  }

  private async markDownstreamStale(manager: Pick<DataSource['manager'], 'query'>, versionId: string): Promise<void> {
    await manager.query(
      `UPDATE workflow_stages
       SET status = $1, stale_reason = 'Strategy changed after confirmation.', updated_at = now()
       WHERE identity_version_id = $2
         AND stage_key IN ('VISUALS', 'ASSETS', 'FINALIZE')
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
