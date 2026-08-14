import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { DomainError } from '../common/domain-error';
import {
  GenerationJobStatus,
  GenerationTask,
  WorkspaceRole,
  WorkflowStageStatus
} from '../database/entities';
import { roleCanAccess } from '../workspaces/workspace-rbac';
import { WorkspacesService } from '../workspaces/workspaces.service';
import type { CreateGenerationDto } from './dto/create-generation.dto';
import { GenerationQueueService } from './generation-queue.service';
import { terminalGenerationStatuses } from './generation-state-machine';

export interface GenerationJobRow {
  id: string;
  workspace_id: string;
  identity_version_id: string;
  brand_context_package_id: string | null;
  brand_context_package_checksum_sha256: string | null;
  status: GenerationJobStatus;
  idempotency_key: string;
  bullmq_job_id: string | null;
  updated_at?: Date | string;
}

type VersionPinRow = {
  id: string;
  active_version_id: string | null;
  active_context_package_id: string | null;
  active_context_package_checksum_sha256: string | null;
};

export interface GenerationStateResponse {
  job: GenerationJobRow;
  runs: unknown[];
  artifacts: unknown[];
}

@Injectable()
export class GenerationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly workspaces: WorkspacesService,
    private readonly queue: GenerationQueueService,
    private readonly config: ConfigService
  ) {}

  async create(
    userId: string,
    dto: CreateGenerationDto,
    rawIdempotencyKey: string | undefined
  ): Promise<GenerationStateResponse> {
    const idempotencyKey = rawIdempotencyKey?.trim();

    if (!idempotencyKey) {
      throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required.', 400);
    }

    await this.assertWorkspaceRole(dto.workspaceId, userId, [WorkspaceRole.Editor]);

    const job = await this.dataSource.transaction(async (manager) => {
      const existingRows = await manager.query<GenerationJobRow[]>(
        `SELECT * FROM generation_jobs WHERE workspace_id = $1 AND idempotency_key = $2`,
        [dto.workspaceId, idempotencyKey]
      );

      if (existingRows[0]) {
        return existingRows[0];
      }

      await this.assertMonthlyBudgetAvailable(dto.workspaceId);

      const versionRows = await manager.query<VersionPinRow[]>(
        `SELECT identity_versions.id,
                identity_projects.active_version_id,
                identity_projects.active_context_package_id,
                brand_context_packages.checksum_sha256 AS active_context_package_checksum_sha256
         FROM identity_versions
         JOIN identity_projects ON identity_projects.id = identity_versions.identity_project_id
         LEFT JOIN brand_context_packages
           ON brand_context_packages.id = identity_projects.active_context_package_id
          AND brand_context_packages.status = 'PUBLISHED'
         WHERE identity_versions.id = $1
           AND identity_projects.workspace_id = $2
           AND identity_projects.status = 'ACTIVE'`,
        [dto.identityVersionId, dto.workspaceId]
      );

      if (!versionRows[0]) {
        throw new DomainError('IDENTITY_VERSION_NOT_FOUND', 'Identity version was not found.', 404);
      }
      const versionPin = versionRows[0];
      const brandContextPackageId =
        versionPin.active_version_id === dto.identityVersionId ? versionPin.active_context_package_id : null;
      const brandContextPackageChecksumSha256 = brandContextPackageId
        ? versionPin.active_context_package_checksum_sha256
        : null;

      const stageRows = await manager.query<{ id: string }[]>(
        `SELECT id FROM workflow_stages WHERE identity_version_id = $1 AND stage_key = $2`,
        [dto.identityVersionId, dto.workflowStageKey]
      );

      if (!stageRows[0]) {
        throw new DomainError('WORKFLOW_STAGE_NOT_FOUND', 'Workflow stage was not found.', 404);
      }

      await this.assertGenerationPrerequisites(manager, dto.identityVersionId, dto.task);

      const insertedRows = await manager.query<GenerationJobRow[]>(
        `INSERT INTO generation_jobs (
          workspace_id, identity_version_id, workflow_stage_key, task, tier, idempotency_key,
          requested_by_user_id, input, brand_context_package_id, brand_context_package_checksum_sha256,
          progress_percent, progress_message, max_attempts
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::uuid, $10, 5, 'Queued for generation.', $11)
        RETURNING *`,
        [
          dto.workspaceId,
          dto.identityVersionId,
          dto.workflowStageKey,
          dto.task,
          dto.tier ?? 'BALANCED',
          idempotencyKey,
          userId,
          JSON.stringify(dto.input ?? {}),
          brandContextPackageId,
          brandContextPackageChecksumSha256,
          dto.maxAttempts ?? 2
        ]
      );

      const inserted = insertedRows[0] as GenerationJobRow;
      await manager.query(
        `UPDATE workflow_stages
         SET status = $1, completion_percent = 5, last_generation_job_id = $2, updated_at = now()
         WHERE identity_version_id = $3 AND stage_key = $4`,
        [WorkflowStageStatus.Generating, inserted.id, dto.identityVersionId, dto.workflowStageKey]
      );

      return inserted;
    });

    if (!job.bullmq_job_id && !terminalGenerationStatuses.has(job.status)) {
      try {
        const bullmqJobId = await this.queue.enqueue(job.id, dto.maxAttempts ?? 2);
        await this.dataSource.query(`UPDATE generation_jobs SET bullmq_job_id = $1, updated_at = now() WHERE id = $2`, [
          bullmqJobId,
          job.id
        ]);
      } catch (error) {
        if (!this.isIdempotencyConflict(error)) {
          throw error;
        }
      }
    }

    return this.get(userId, job.id);
  }

  async get(userId: string, jobId: string): Promise<GenerationStateResponse> {
    const job = await this.getAuthorizedJob(userId, jobId, [WorkspaceRole.Viewer]);
    const runs = await this.dataSource.query(
      `SELECT * FROM ai_generation_runs WHERE generation_job_id = $1 ORDER BY attempt_number ASC`,
      [job.id]
    );
    const artifacts = await this.dataSource.query(
      `SELECT * FROM generation_artifacts WHERE generation_job_id = $1 ORDER BY created_at ASC`,
      [job.id]
    );

    return { job, runs, artifacts };
  }

  async cancel(userId: string, jobId: string): Promise<GenerationStateResponse> {
    const job = await this.getAuthorizedJob(userId, jobId, [WorkspaceRole.Editor]);

    if (terminalGenerationStatuses.has(job.status)) {
      return this.get(userId, jobId);
    }

    const removedFromQueue = await this.queue.requestCancel(job.id);
    await this.dataSource.query(
       `UPDATE generation_jobs
         SET status = $1::generation_job_status, cancellation_requested_at = now(), updated_at = now(),
            progress_message = CASE WHEN $1::generation_job_status = 'CANCELLED'::generation_job_status
              THEN 'Cancelled before execution.' ELSE 'Cancellation requested.' END
         WHERE id = $2
           AND status NOT IN ('SUCCEEDED'::generation_job_status, 'FAILED'::generation_job_status, 'CANCELLED'::generation_job_status)`,
      [removedFromQueue ? GenerationJobStatus.Cancelled : GenerationJobStatus.CancelRequested, jobId]
    );

    return this.get(userId, jobId);
  }

  async currentEvent(userId: string, jobId: string): Promise<{ id: string; type: string; data: unknown }> {
    const state = await this.get(userId, jobId);
    return {
      id: state.job.updated_at ? `${state.job.id}:${new Date(state.job.updated_at).getTime()}` : state.job.id,
      type: 'generation.state',
      data: state
    };
  }

  private async getAuthorizedJob(userId: string, jobId: string, allowedRoles: WorkspaceRole[]) {
    const rows = await this.dataSource.query(
      `SELECT generation_jobs.*
       FROM generation_jobs
       WHERE generation_jobs.id = $1`,
      [jobId]
    );
    const job = rows[0] as GenerationJobRow | undefined;

    if (!job) {
      throw new DomainError('GENERATION_JOB_NOT_FOUND', 'Generation job was not found.', 404);
    }

    await this.assertWorkspaceRole(job.workspace_id, userId, allowedRoles);
    return job;
  }

  private async assertWorkspaceRole(workspaceId: string, userId: string, allowedRoles: WorkspaceRole[]) {
    const membership = await this.workspaces.findActiveMembership(workspaceId, userId);

    if (!membership) {
      throw new DomainError('WORKSPACE_NOT_FOUND', 'Workspace was not found.', 404);
    }

    if (!roleCanAccess(membership.role, allowedRoles)) {
      throw new DomainError('WORKSPACE_ROLE_NOT_ALLOWED', 'Workspace role is not allowed.', 403);
    }
  }

  private async assertMonthlyBudgetAvailable(workspaceId: string) {
    const budget = this.config.get<number>('AI_WORKSPACE_MONTHLY_BUDGET_MICRO_USD') ?? 100_000_000;
    if (budget === 0) {
      throw new DomainError('AI_BUDGET_EXHAUSTED', 'AI generation budget is disabled for this workspace.', 402);
    }

    const precharge = this.config.get<number>('AI_GENERATION_PRECHARGE_MICRO_USD') ?? 1_000_000;
    const rows = await this.dataSource.query<{ used_micro_usd: string }[]>(
      `SELECT COALESCE(SUM(ai_generation_runs.estimated_cost_micro_usd), 0) AS used_micro_usd
       FROM ai_generation_runs
       JOIN generation_jobs ON generation_jobs.id = ai_generation_runs.generation_job_id
       WHERE generation_jobs.workspace_id = $1
         AND ai_generation_runs.started_at >= date_trunc('month', now())`,
      [workspaceId]
    );
    const used = Number(rows[0]?.used_micro_usd ?? 0);
    if (used + precharge > budget) {
      throw new DomainError('AI_BUDGET_EXHAUSTED', 'Monthly AI generation budget would be exceeded.', 402, {
        usedMicroUsd: used,
        budgetMicroUsd: budget,
        prechargeMicroUsd: precharge
      });
    }
  }

  private async assertGenerationPrerequisites(
    manager: EntityManager,
    identityVersionId: string,
    task: GenerationTask
  ): Promise<void> {
    if (
      task !== GenerationTask.StrategyGenerate &&
      task !== GenerationTask.StrategySectionRegenerate &&
      task !== GenerationTask.CompetitorResearch
    ) {
      return;
    }

    const rows = await manager.query<{ confirmed_at: Date | null; status: WorkflowStageStatus }[]>(
      `SELECT brand_briefs.confirmed_at, workflow_stages.status
       FROM brand_briefs
       JOIN workflow_stages
         ON workflow_stages.identity_version_id = brand_briefs.identity_version_id
        AND workflow_stages.stage_key = 'BRIEF'
       WHERE brand_briefs.identity_version_id = $1`,
      [identityVersionId]
    );

    if (!rows[0]?.confirmed_at || rows[0].status !== WorkflowStageStatus.Completed) {
      throw new DomainError('BRIEF_NOT_COMPLETE', 'Complete the Brief before generating Strategy.', 409);
    }
  }

  private isIdempotencyConflict(error: unknown): boolean {
    return error instanceof QueryFailedError && (error as QueryFailedError & { code?: string }).code === '23505';
  }
}
