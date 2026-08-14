import { Injectable, Optional } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { BrandBooksService } from '../brand-books/brand-books.service';
import { DomainError } from '../common/domain-error';
import { AiGenerationTier, GenerationTask, WorkflowStageKey } from '../database/entities';
import { GenerationsService } from '../generations/generations.service';
import type { AutopilotRunEventDto, CloneIdentityVersionDto, CreateIdentityProjectDto, UpdateIdentityProjectDto } from './dto/identity-project.dto';
import { createDefaultWorkflowStages, slugifyProjectName } from './workflow-stage.factory';

export interface IdentityVersionActivityItem {
  id: string;
  workflow_stage_key: string;
  task: string;
  tier: string;
  status: string;
  progress_percent: number;
  progress_message: string | null;
  error_code: string | null;
  error_message: string | null;
  attempts: number;
  max_attempts: number;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  failed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  latest_run_status: string | null;
  latest_model: string | null;
  latest_provider: string | null;
  total_tokens: number;
  artifact_count: number;
  artifact_names: string[];
}

export interface AiEmployeeHandoffItem {
  id: string;
  identity_version_id: string;
  generation_job_id: string | null;
  from_stage_key: string;
  to_stage_key: string | null;
  task: string;
  employee_role: string;
  summary: string;
  notes: string[];
  recommendations: string[];
  is_current: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface IdentityStageReadinessItem {
  stage_key: string;
  employee_role: string;
  status: 'READY' | 'BLOCKED' | 'NEEDS_INPUT' | 'IN_PROGRESS' | 'COMPLETE';
  summary: string;
  reasons: string[];
  recommended_actions: string[];
  actions: IdentityStageReadinessAction[];
}

export interface IdentityStageReadinessAction {
  code:
    | 'NAVIGATE_STAGE'
    | 'REFRESH_READINESS'
    | 'RUN_COMPETITOR_RESEARCH'
    | 'RUN_STRATEGY_GENERATION'
    | 'RUN_VISUAL_DIRECTIONS'
    | 'RUN_LOGO_CONCEPTS'
    | 'RUN_BRAND_BOOK';
  label: string;
  stage_key: string;
  style: 'primary' | 'secondary';
}

export interface AiEmployeeAutopilotRun {
  id: string;
  workspace_id: string;
  identity_project_id: string;
  identity_version_id: string;
  started_by_user_id: string | null;
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  current_stage_key: string | null;
  last_action_code: string | null;
  completed_steps: number;
  pause_reason: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  started_at: Date | string;
  paused_at: Date | string | null;
  completed_at: Date | string | null;
  failed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface AiEmployeeAutopilotEvent {
  id: string;
  autopilot_run_id: string;
  generation_job_id: string | null;
  event_type: 'STARTED' | 'ACTION_STARTED' | 'ACTION_SUCCEEDED' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  stage_key: string | null;
  action_code: string | null;
  message: string;
  metadata: Record<string, unknown>;
  created_at: Date | string;
}

export interface AiEmployeeAutopilotAdvanceResult {
  run: AiEmployeeAutopilotRun | null;
  events: AiEmployeeAutopilotEvent[];
  status: 'JOB_STARTED' | 'WAITING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  message: string;
  generationJobId?: string;
}

export interface AiEmployeeAutopilotHistoryItem extends AiEmployeeAutopilotRun {
  event_count: number;
  latest_event_type: string | null;
  latest_event_message: string | null;
  latest_event_at: Date | string | null;
}

@Injectable()
export class IdentityProjectsService {
  constructor(
    private readonly dataSource: DataSource,
    @Optional() private readonly generations?: GenerationsService,
    @Optional() private readonly brandBooks?: BrandBooksService
  ) {}

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

  async activity(workspaceId: string, projectId: string, versionId: string): Promise<IdentityVersionActivityItem[]> {
    await this.assertVersionAccess(workspaceId, projectId, versionId);

    return this.dataSource.query<IdentityVersionActivityItem[]>(
      `SELECT generation_jobs.id,
              generation_jobs.workflow_stage_key,
              generation_jobs.task,
              generation_jobs.tier,
              generation_jobs.status,
              generation_jobs.progress_percent,
              generation_jobs.progress_message,
              generation_jobs.error_code,
              generation_jobs.error_message,
              generation_jobs.attempts,
              generation_jobs.max_attempts,
              generation_jobs.started_at,
              generation_jobs.completed_at,
              generation_jobs.failed_at,
              generation_jobs.created_at,
              generation_jobs.updated_at,
              latest_run.status AS latest_run_status,
              latest_run.actual_model AS latest_model,
              latest_run.actual_provider AS latest_provider,
              COALESCE(latest_run.total_tokens, 0) AS total_tokens,
              COALESCE(artifact_summary.artifact_count, 0)::int AS artifact_count,
              COALESCE(artifact_summary.artifact_names, '[]'::jsonb) AS artifact_names
       FROM generation_jobs
       LEFT JOIN LATERAL (
         SELECT ai_generation_runs.status,
                ai_generation_runs.actual_model,
                ai_generation_runs.actual_provider,
                ai_generation_runs.total_tokens
         FROM ai_generation_runs
         WHERE ai_generation_runs.generation_job_id = generation_jobs.id
         ORDER BY ai_generation_runs.attempt_number DESC, ai_generation_runs.started_at DESC
         LIMIT 1
       ) latest_run ON true
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS artifact_count,
                jsonb_agg(generation_artifacts.name ORDER BY generation_artifacts.created_at) AS artifact_names
         FROM generation_artifacts
         WHERE generation_artifacts.generation_job_id = generation_jobs.id
       ) artifact_summary ON true
       WHERE generation_jobs.identity_version_id = $1::uuid
       ORDER BY generation_jobs.created_at DESC, generation_jobs.id DESC
       LIMIT 30`,
      [versionId]
    );
  }

  async handoffs(workspaceId: string, projectId: string, versionId: string): Promise<AiEmployeeHandoffItem[]> {
    await this.assertVersionAccess(workspaceId, projectId, versionId);

    return this.dataSource.query<AiEmployeeHandoffItem[]>(
      `SELECT id,
              identity_version_id,
              generation_job_id,
              from_stage_key,
              to_stage_key,
              task,
              employee_role,
              summary,
              notes,
              recommendations,
              is_current,
              created_at,
              updated_at
       FROM ai_employee_handoffs
       WHERE identity_version_id = $1::uuid
       ORDER BY created_at DESC, id DESC
       LIMIT 30`,
      [versionId]
    );
  }

  async readiness(workspaceId: string, projectId: string, versionId: string): Promise<IdentityStageReadinessItem[]> {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const rows = await this.dataSource.query<Array<Record<string, unknown>>>(
      `SELECT
         identity_versions.status AS version_status,
         EXISTS(SELECT 1 FROM brand_briefs WHERE identity_version_id = $1::uuid AND confirmed_at IS NOT NULL) AS brief_confirmed,
         EXISTS(SELECT 1 FROM competitor_researches WHERE identity_version_id = $1::uuid AND is_current AND status = 'READY') AS competitor_research_ready,
         EXISTS(SELECT 1 FROM brand_strategies WHERE identity_version_id = $1::uuid AND confirmed_at IS NOT NULL) AS strategy_confirmed,
         EXISTS(SELECT 1 FROM brand_strategies WHERE identity_version_id = $1::uuid AND completion_percent = 100) AS strategy_complete,
         EXISTS(SELECT 1 FROM visual_directions WHERE identity_version_id = $1::uuid AND status = 'ACTIVE') AS visual_direction_exists,
         EXISTS(SELECT 1 FROM visual_directions WHERE identity_version_id = $1::uuid AND status = 'ACTIVE' AND is_selected) AS visual_direction_selected,
         EXISTS(SELECT 1 FROM logo_concepts WHERE identity_version_id = $1::uuid AND status <> 'ARCHIVED') AS logo_concept_exists,
         EXISTS(SELECT 1 FROM logo_concepts WHERE identity_version_id = $1::uuid AND status = 'SELECTED') AS logo_concept_selected,
         EXISTS(SELECT 1 FROM brand_books WHERE identity_version_id = $1::uuid AND is_current AND status = 'READY') AS brand_book_ready,
         EXISTS(SELECT 1 FROM generation_jobs WHERE identity_version_id = $1::uuid AND status IN ('QUEUED', 'RUNNING', 'CANCEL_REQUESTED', 'STALLED')) AS has_running_job,
         COALESCE((SELECT jsonb_object_agg(stage_key, status) FROM workflow_stages WHERE identity_version_id = $1::uuid), '{}'::jsonb) AS stage_statuses
       FROM identity_versions
       WHERE id = $1::uuid`,
      [versionId]
    );
    const facts = rows[0] ?? {};
    const stageStatuses = (facts.stage_statuses ?? {}) as Record<string, string>;
    const running = booleanFact(facts.has_running_job);

    return [
      readinessForBrief(stageStatuses.BRIEF, facts, running),
      readinessForStrategy(stageStatuses.STRATEGY, facts, running),
      readinessForVisuals(stageStatuses.VISUALS, facts, running),
      readinessForAssets(stageStatuses.ASSETS, facts, running),
      readinessForFinalize(stageStatuses.FINALIZE, facts, running)
    ];
  }

  async currentAutopilot(workspaceId: string, projectId: string, versionId: string) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const run = await this.findCurrentAutopilotRun(versionId);

    return {
      run,
      events: run ? await this.autopilotEvents(run.id) : []
    };
  }

  async autopilotHistory(
    workspaceId: string,
    projectId: string,
    versionId: string,
    limit = 10
  ): Promise<{ runs: AiEmployeeAutopilotHistoryItem[] }> {
    await this.assertVersionAccess(workspaceId, projectId, versionId);

    const runs = await this.dataSource.query<AiEmployeeAutopilotHistoryItem[]>(
      `SELECT runs.*,
              COALESCE(event_summary.event_count, 0)::int AS event_count,
              event_summary.latest_event_type,
              event_summary.latest_event_message,
              event_summary.latest_event_at
       FROM ai_employee_autopilot_runs runs
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS event_count,
                (array_agg(events.event_type ORDER BY events.created_at DESC, events.id DESC))[1] AS latest_event_type,
                (array_agg(events.message ORDER BY events.created_at DESC, events.id DESC))[1] AS latest_event_message,
                max(events.created_at) AS latest_event_at
         FROM ai_employee_autopilot_events events
         WHERE events.autopilot_run_id = runs.id
       ) event_summary ON true
       WHERE runs.identity_version_id = $1::uuid
       ORDER BY runs.created_at DESC, runs.id DESC
       LIMIT $2`,
      [versionId, Math.min(Math.max(limit, 1), 50)]
    );

    return { runs };
  }

  async startAutopilot(workspaceId: string, projectId: string, versionId: string, userId: string) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const existing = await this.findCurrentAutopilotRun(versionId);

    if (existing) {
      if (existing.status === 'PAUSED') {
        const existingRunId = existing.id;
        if (!existingRunId) {
          throw new DomainError('AUTOPILOT_RUN_ID_MISSING', 'AI Employee Autopilot run id is missing.', 500);
        }

        const resumedRows = await this.dataSource.query<AiEmployeeAutopilotRun[]>(
          `UPDATE ai_employee_autopilot_runs
           SET status = 'RUNNING',
               pause_reason = NULL,
               paused_at = NULL,
               updated_at = now()
           WHERE id = $1::uuid
           RETURNING *`,
          [existingRunId]
        );
        const resumed = resumedRows[0]?.id ? resumedRows[0] : (await this.getAutopilotRunById(existingRunId)) ?? existing;
        const resumedRunId = resumed.id ?? existingRunId;
        await this.insertAutopilotEvent(resumedRunId, {
          eventType: 'STARTED',
          message: 'AI Employee Autopilot resumed.',
          metadata: { resumed: true }
        });
        return { run: resumed, events: await this.autopilotEvents(resumedRunId) };
      }

      return { run: existing, events: await this.autopilotEvents(existing.id) };
    }

    const runRows = await this.dataSource.query<AiEmployeeAutopilotRun[]>(
      `INSERT INTO ai_employee_autopilot_runs (
         workspace_id,
         identity_project_id,
         identity_version_id,
         started_by_user_id,
         status,
         metadata
       )
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'RUNNING', $5::jsonb)
       RETURNING *`,
      [workspaceId, projectId, versionId, userId, JSON.stringify({ source: 'readiness_panel' })]
    );
    const run = runRows[0];

    if (!run) {
      throw new DomainError('AUTOPILOT_START_FAILED', 'Could not start AI Employee Autopilot.', 500);
    }

    await this.insertAutopilotEvent(run.id, {
      eventType: 'STARTED',
      message: 'AI Employee Autopilot started.',
      metadata: { source: 'readiness_panel' }
    });

    return { run, events: await this.autopilotEvents(run.id) };
  }

  async advanceAutopilot(
    workspaceId: string,
    projectId: string,
    versionId: string,
    userId: string
  ): Promise<AiEmployeeAutopilotAdvanceResult> {
    const started = await this.startAutopilot(workspaceId, projectId, versionId, userId);
    const run = started.run;

    if (!run) {
      throw new DomainError('AUTOPILOT_RUN_NOT_FOUND', 'AI Employee Autopilot run was not found.', 404);
    }

    const reconciledFailure = await this.reconcileAutopilotGenerationEvents(run.id);
    if (reconciledFailure) {
      const failed = await this.failAutopilot(workspaceId, projectId, versionId, run.id, reconciledFailure);
      return {
        ...failed,
        status: 'FAILED',
        message: reconciledFailure
      };
    }

    const readiness = await this.readiness(workspaceId, projectId, versionId);
    const nextAction = selectNextServerAutopilotAction(readiness);

    if (!nextAction) {
      const completed = await this.completeAutopilot(
        workspaceId,
        projectId,
        versionId,
        run.id,
        'Autopilot found no more safe automatic actions.'
      );
      return {
        ...completed,
        status: 'COMPLETED',
        message: 'Autopilot found no more safe automatic actions.'
      };
    }

    if (nextAction.code === 'REFRESH_READINESS') {
      return {
        run,
        events: await this.autopilotEvents(run.id),
        status: 'WAITING',
        message: 'Another AI employee job is already running.'
      };
    }

    if (!isServerAutopilotGenerationAction(nextAction)) {
      const paused = await this.pauseAutopilot(
        workspaceId,
        projectId,
        versionId,
        run.id,
        `Autopilot paused at ${nextAction.stage_key}: ${nextAction.label}. Human review is required.`
      );
      return {
        ...paused,
        status: 'PAUSED',
        message: `Autopilot paused at ${nextAction.stage_key}: ${nextAction.label}. Human review is required.`
      };
    }

    if (nextAction.code === 'RUN_BRAND_BOOK') {
      if (!this.brandBooks) {
        throw new DomainError('AUTOPILOT_BRAND_BOOK_UNAVAILABLE', 'Brand book service is unavailable for Autopilot.', 500);
      }

      await this.insertAutopilotEvent(run.id, {
        eventType: 'ACTION_STARTED',
        stageKey: nextAction.stage_key,
        actionCode: nextAction.code,
        message: nextAction.label
      });
      await this.brandBooks.generate(workspaceId, projectId, versionId);
      await this.insertAutopilotEvent(run.id, {
        eventType: 'ACTION_SUCCEEDED',
        stageKey: nextAction.stage_key,
        actionCode: nextAction.code,
        message: `${nextAction.label} completed.`
      });
      const paused = await this.pauseAutopilot(
        workspaceId,
        projectId,
        versionId,
        run.id,
        'Brand book generated. Agency approval and activation are required.'
      );
      return {
        ...paused,
        status: 'PAUSED',
        message: 'Brand book generated. Agency approval and activation are required.'
      };
    }

    if (!this.generations) {
      throw new DomainError('AUTOPILOT_GENERATIONS_UNAVAILABLE', 'Generation service is unavailable for Autopilot.', 500);
    }

    const generation = await this.generations.create(
      userId,
      generationDtoForAutopilotAction(workspaceId, versionId, nextAction),
      `autopilot-${run.id}-${run.completed_steps + 1}-${nextAction.code}`
    );
    await this.appendAutopilotEvent(workspaceId, projectId, versionId, run.id, {
      eventType: 'ACTION_STARTED',
      stageKey: nextAction.stage_key,
      actionCode: nextAction.code,
      generationJobId: generation.job.id,
      message: `${nextAction.label} queued.`
    });

    return {
      run: await this.findCurrentAutopilotRun(versionId),
      events: await this.autopilotEvents(run.id),
      status: 'JOB_STARTED',
      message: `${nextAction.label} queued.`,
      generationJobId: generation.job.id
    };
  }

  async appendAutopilotEvent(
    workspaceId: string,
    projectId: string,
    versionId: string,
    runId: string,
    dto: AutopilotRunEventDto
  ) {
    await this.assertAutopilotRunAccess(workspaceId, projectId, versionId, runId);
    await this.insertAutopilotEvent(runId, dto);
    const updatedRows = await this.dataSource.query<AiEmployeeAutopilotRun[]>(
      `UPDATE ai_employee_autopilot_runs
       SET current_stage_key = COALESCE($2::workflow_stage_key, current_stage_key),
           last_action_code = COALESCE($3, last_action_code),
           completed_steps = completed_steps + CASE WHEN $4 = 'ACTION_SUCCEEDED' THEN 1 ELSE 0 END,
           updated_at = now()
       WHERE id = $1::uuid
       RETURNING *`,
      [runId, normalizeStageKey(dto.stageKey), dto.actionCode ?? null, dto.eventType]
    );

    return {
      run: updatedRows[0] ?? null,
      events: await this.autopilotEvents(runId)
    };
  }

  async pauseAutopilot(workspaceId: string, projectId: string, versionId: string, runId: string, reason: string) {
    await this.assertAutopilotRunAccess(workspaceId, projectId, versionId, runId);
    const message = reason.trim() || 'Human review is required.';
    const rows = await this.dataSource.query<AiEmployeeAutopilotRun[]>(
      `UPDATE ai_employee_autopilot_runs
       SET status = 'PAUSED',
           pause_reason = $2,
           paused_at = now(),
           updated_at = now()
       WHERE id = $1::uuid
       RETURNING *`,
      [runId, message]
    );
    await this.insertAutopilotEvent(runId, {
      eventType: 'PAUSED',
      message
    });

    return { run: rows[0] ?? null, events: await this.autopilotEvents(runId) };
  }

  async completeAutopilot(workspaceId: string, projectId: string, versionId: string, runId: string, reason: string) {
    await this.assertAutopilotRunAccess(workspaceId, projectId, versionId, runId);
    const message = reason.trim() || 'Autopilot completed.';
    const rows = await this.dataSource.query<AiEmployeeAutopilotRun[]>(
      `UPDATE ai_employee_autopilot_runs
       SET status = 'COMPLETED',
           completed_at = now(),
           updated_at = now()
       WHERE id = $1::uuid
       RETURNING *`,
      [runId]
    );
    await this.insertAutopilotEvent(runId, {
      eventType: 'COMPLETED',
      message
    });

    return { run: rows[0] ?? null, events: await this.autopilotEvents(runId) };
  }

  async failAutopilot(workspaceId: string, projectId: string, versionId: string, runId: string, errorMessage: string) {
    await this.assertAutopilotRunAccess(workspaceId, projectId, versionId, runId);
    const message = errorMessage.trim() || 'Autopilot failed.';
    const rows = await this.dataSource.query<AiEmployeeAutopilotRun[]>(
      `UPDATE ai_employee_autopilot_runs
       SET status = 'FAILED',
           error_message = $2,
           failed_at = now(),
           updated_at = now()
       WHERE id = $1::uuid
       RETURNING *`,
      [runId, message]
    );
    await this.insertAutopilotEvent(runId, {
      eventType: 'FAILED',
      message
    });

    return { run: rows[0] ?? null, events: await this.autopilotEvents(runId) };
  }

  async cancelAutopilot(workspaceId: string, projectId: string, versionId: string, runId: string, reason: string) {
    await this.assertAutopilotRunAccess(workspaceId, projectId, versionId, runId);
    const message = reason.trim() || 'Autopilot cancelled by user.';
    const rows = await this.dataSource.query<AiEmployeeAutopilotRun[]>(
      `UPDATE ai_employee_autopilot_runs
       SET status = 'CANCELLED',
           pause_reason = $2,
           paused_at = now(),
           updated_at = now()
       WHERE id = $1::uuid
         AND status IN ('RUNNING', 'PAUSED')
       RETURNING *`,
      [runId, message]
    );
    if (rows[0]) {
      await this.insertAutopilotEvent(runId, {
        eventType: 'CANCELLED',
        message
      });
    }

    return { run: rows[0] ?? (await this.getAutopilotRunById(runId)), events: await this.autopilotEvents(runId) };
  }

  async retryAutopilot(workspaceId: string, projectId: string, versionId: string, runId: string, userId: string) {
    await this.assertAutopilotRunAccess(workspaceId, projectId, versionId, runId);
    const existing = await this.getAutopilotRunById(runId);
    if (!existing) {
      throw new DomainError('AUTOPILOT_RUN_NOT_FOUND', 'AI Employee Autopilot run was not found.', 404);
    }

    if (existing.status === 'RUNNING' || existing.status === 'PAUSED') {
      return { run: existing, events: await this.autopilotEvents(existing.id) };
    }

    const current = await this.findCurrentAutopilotRun(versionId);
    if (current) {
      return { run: current, events: await this.autopilotEvents(current.id) };
    }

    const runRows = await this.dataSource.query<AiEmployeeAutopilotRun[]>(
      `INSERT INTO ai_employee_autopilot_runs (
         workspace_id,
         identity_project_id,
         identity_version_id,
         started_by_user_id,
         status,
         metadata
       )
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'RUNNING', $5::jsonb)
       RETURNING *`,
      [workspaceId, projectId, versionId, userId, JSON.stringify({ source: 'readiness_panel', retryOfRunId: runId })]
    );
    const run = runRows[0];

    if (!run) {
      throw new DomainError('AUTOPILOT_RETRY_FAILED', 'Could not retry AI Employee Autopilot.', 500);
    }

    await this.insertAutopilotEvent(run.id, {
      eventType: 'STARTED',
      message: `AI Employee Autopilot retry started from run ${runId}.`,
      metadata: { retryOfRunId: runId }
    });

    return { run, events: await this.autopilotEvents(run.id) };
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

  private async assertVersionAccess(workspaceId: string, projectId: string, versionId: string): Promise<void> {
    const versionRows = await this.dataSource.query<{ id: string }[]>(
      `SELECT identity_versions.id
       FROM identity_versions
       JOIN identity_projects ON identity_projects.id = identity_versions.identity_project_id
       WHERE identity_versions.id = $1::uuid
         AND identity_projects.id = $2::uuid
         AND identity_projects.workspace_id = $3::uuid
         AND identity_projects.status = 'ACTIVE'`,
      [versionId, projectId, workspaceId]
    );

    if (!versionRows[0]) {
      throw new DomainError('IDENTITY_VERSION_NOT_FOUND', 'Identity version was not found.', 404);
    }
  }

  private async findCurrentAutopilotRun(versionId: string): Promise<AiEmployeeAutopilotRun | null> {
    const rows = await this.dataSource.query<AiEmployeeAutopilotRun[]>(
      `SELECT *
       FROM ai_employee_autopilot_runs
       WHERE identity_version_id = $1::uuid
         AND status IN ('RUNNING', 'PAUSED')
       ORDER BY created_at DESC
       LIMIT 1`,
      [versionId]
    );

    return rows[0] ?? null;
  }

  private async getAutopilotRunById(runId: string): Promise<AiEmployeeAutopilotRun | null> {
    const rows = await this.dataSource.query<AiEmployeeAutopilotRun[]>(`SELECT * FROM ai_employee_autopilot_runs WHERE id = $1::uuid`, [
      runId
    ]);

    return rows[0] ?? null;
  }

  private autopilotEvents(runId: string): Promise<AiEmployeeAutopilotEvent[]> {
    return this.dataSource.query<AiEmployeeAutopilotEvent[]>(
      `SELECT *
       FROM ai_employee_autopilot_events
       WHERE autopilot_run_id = $1::uuid
       ORDER BY created_at ASC, id ASC`,
      [runId]
    );
  }

  private async insertAutopilotEvent(runId: string, event: AutopilotEventInput): Promise<void> {
    if (!runId) {
      throw new DomainError('AUTOPILOT_RUN_ID_MISSING', 'AI Employee Autopilot run id is missing.', 500);
    }

    await this.dataSource.query(
      `INSERT INTO ai_employee_autopilot_events (
         autopilot_run_id,
         generation_job_id,
         event_type,
         stage_key,
         action_code,
         message,
         metadata
       )
       VALUES ($1::uuid, $2::uuid, $3, $4::workflow_stage_key, $5, $6, $7::jsonb)`,
      [
        runId,
        event.generationJobId ?? null,
        event.eventType,
        normalizeStageKey(event.stageKey),
        event.actionCode ?? null,
        event.message.trim(),
        JSON.stringify(event.metadata ?? {})
      ]
    );
  }

  private async assertAutopilotRunAccess(workspaceId: string, projectId: string, versionId: string, runId: string): Promise<void> {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const rows = await this.dataSource.query<{ id: string }[]>(
      `SELECT id
       FROM ai_employee_autopilot_runs
       WHERE id = $1::uuid
         AND workspace_id = $2::uuid
         AND identity_project_id = $3::uuid
         AND identity_version_id = $4::uuid`,
      [runId, workspaceId, projectId, versionId]
    );

    if (!rows[0]) {
      throw new DomainError('AUTOPILOT_RUN_NOT_FOUND', 'AI Employee Autopilot run was not found.', 404);
    }
  }

  private async reconcileAutopilotGenerationEvents(runId: string): Promise<string | null> {
    const terminalRows = await this.dataSource.query<
      Array<{
        generation_job_id: string;
        stage_key: string | null;
        action_code: string | null;
        status: string;
        error_message: string | null;
      }>
    >(
      `SELECT started.generation_job_id,
              started.stage_key,
              started.action_code,
              generation_jobs.status,
              generation_jobs.error_message
       FROM ai_employee_autopilot_events started
       JOIN generation_jobs ON generation_jobs.id = started.generation_job_id
       WHERE started.autopilot_run_id = $1::uuid
         AND started.event_type = 'ACTION_STARTED'
         AND started.generation_job_id IS NOT NULL
         AND generation_jobs.status IN ('SUCCEEDED', 'FAILED', 'CANCELLED')
         AND NOT EXISTS (
           SELECT 1
           FROM ai_employee_autopilot_events terminal
           WHERE terminal.autopilot_run_id = started.autopilot_run_id
             AND terminal.generation_job_id = started.generation_job_id
             AND terminal.event_type IN ('ACTION_SUCCEEDED', 'FAILED')
         )
       ORDER BY generation_jobs.completed_at ASC NULLS LAST, started.created_at ASC`,
      [runId]
    );

    for (const row of terminalRows) {
      if (row.status === 'SUCCEEDED') {
        const successEvent: AutopilotEventInput = {
          eventType: 'ACTION_SUCCEEDED',
          generationJobId: row.generation_job_id,
          message: `${row.action_code ?? 'Autopilot action'} completed.`
        };
        if (row.stage_key) successEvent.stageKey = row.stage_key;
        if (row.action_code) successEvent.actionCode = row.action_code;
        await this.insertAutopilotEvent(runId, successEvent);
        await this.dataSource.query(
          `UPDATE ai_employee_autopilot_runs
           SET completed_steps = completed_steps + 1,
               current_stage_key = COALESCE($2::workflow_stage_key, current_stage_key),
               last_action_code = COALESCE($3, last_action_code),
               updated_at = now()
           WHERE id = $1::uuid`,
          [runId, normalizeStageKey(row.stage_key ?? undefined), row.action_code]
        );
      } else {
        return row.error_message ?? `Autopilot generation job ${row.generation_job_id} ${row.status.toLowerCase()}.`;
      }
    }

    return null;
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof QueryFailedError && (error as QueryFailedError & { code?: string }).code === '23505';
  }
}

type AutopilotEventInput = {
  eventType: AiEmployeeAutopilotEvent['event_type'];
  stageKey?: string;
  actionCode?: string;
  message: string;
  generationJobId?: string;
  metadata?: Record<string, unknown>;
};

function readinessForBrief(
  stageStatus: string | undefined,
  facts: Record<string, unknown>,
  running: boolean
): IdentityStageReadinessItem {
  if (running && stageStatus === 'GENERATING') {
    return item('BRIEF', 'Brief Analyst', 'IN_PROGRESS', 'Brief AI work is running.', [], ['Wait for the brief job to finish.'], [
      action('REFRESH_READINESS', 'Refresh status', 'BRIEF', 'secondary')
    ]);
  }

  if (booleanFact(facts.brief_confirmed)) {
    return item('BRIEF', 'Brief Analyst', 'COMPLETE', 'Brief is complete and ready for Strategy.', [], ['Move to Strategy.'], [
      action('NAVIGATE_STAGE', 'Move to Strategy', 'STRATEGY', 'primary')
    ]);
  }

  return item(
    'BRIEF',
    'Brief Analyst',
    'NEEDS_INPUT',
    'Brief needs user input before the strategy employee can work.',
    ['Required brief fields are not confirmed yet.'],
    ['Fill missing brief fields.', 'Run or rerun brief AI if helpful.', 'Complete the Brief step.'],
    [action('NAVIGATE_STAGE', 'Open Brief', 'BRIEF', 'primary')]
  );
}

function readinessForStrategy(
  stageStatus: string | undefined,
  facts: Record<string, unknown>,
  running: boolean
): IdentityStageReadinessItem {
  if (!booleanFact(facts.brief_confirmed)) {
    return item('STRATEGY', 'Strategy Writer', 'BLOCKED', 'Strategy is blocked until Brief is complete.', ['Brief is not confirmed.'], ['Complete Brief first.'], [
      action('NAVIGATE_STAGE', 'Complete Brief', 'BRIEF', 'primary')
    ]);
  }

  if (running && stageStatus === 'GENERATING') {
    return item('STRATEGY', 'Strategy Writer', 'IN_PROGRESS', 'Strategy AI work is running.', [], ['Wait for the strategy job to finish.'], [
      action('REFRESH_READINESS', 'Refresh status', 'STRATEGY', 'secondary')
    ]);
  }

  if (booleanFact(facts.strategy_confirmed)) {
    return item('STRATEGY', 'Strategy Writer', 'COMPLETE', 'Strategy is complete and ready for Visuals.', [], ['Move to Visuals.'], [
      action('NAVIGATE_STAGE', 'Move to Visuals', 'VISUALS', 'primary')
    ]);
  }

  if (!booleanFact(facts.competitor_research_ready)) {
    return item(
      'STRATEGY',
      'Research Strategist',
      'NEEDS_INPUT',
      'Strategy should be grounded with competitor research before generation.',
      ['No current competitor research snapshot is attached.'],
      ['Run competitor research.', 'If you intentionally want to skip research, generate strategy anyway and review carefully.'],
      [
        action('RUN_COMPETITOR_RESEARCH', 'Run competitor research', 'STRATEGY', 'primary'),
        action('RUN_STRATEGY_GENERATION', 'Generate strategy anyway', 'STRATEGY', 'secondary')
      ]
    );
  }

  if (booleanFact(facts.strategy_complete)) {
    return item(
      'STRATEGY',
      'Strategy Writer',
      'NEEDS_INPUT',
      'Strategy content is complete but needs user confirmation.',
      ['Strategy has complete fields but has not been completed by the user.'],
      ['Review the strategy.', 'Click Complete strategy.'],
      [action('NAVIGATE_STAGE', 'Review strategy', 'STRATEGY', 'primary')]
    );
  }

  return item('STRATEGY', 'Strategy Writer', 'READY', 'Strategy Writer is ready to generate or refine strategy.', [], ['Generate strategy.'], [
    action('RUN_STRATEGY_GENERATION', 'Generate strategy', 'STRATEGY', 'primary')
  ]);
}

function readinessForVisuals(
  stageStatus: string | undefined,
  facts: Record<string, unknown>,
  running: boolean
): IdentityStageReadinessItem {
  if (!booleanFact(facts.strategy_confirmed)) {
    return item('VISUALS', 'Visual Director', 'BLOCKED', 'Visuals are blocked until Strategy is complete.', ['Strategy is not confirmed.'], ['Complete Strategy first.'], [
      action('NAVIGATE_STAGE', 'Complete Strategy', 'STRATEGY', 'primary')
    ]);
  }

  if (running && stageStatus === 'GENERATING') {
    return item('VISUALS', 'Visual Director', 'IN_PROGRESS', 'Visual direction AI work is running.', [], ['Wait for the visual direction job to finish.'], [
      action('REFRESH_READINESS', 'Refresh status', 'VISUALS', 'secondary')
    ]);
  }

  if (booleanFact(facts.visual_direction_selected)) {
    return item('VISUALS', 'Visual Director', 'COMPLETE', 'A visual direction is selected and ready for Assets.', [], ['Move to Assets.'], [
      action('NAVIGATE_STAGE', 'Move to Assets', 'ASSETS', 'primary')
    ]);
  }

  if (booleanFact(facts.visual_direction_exists)) {
    return item(
      'VISUALS',
      'Visual Director',
      'NEEDS_INPUT',
      'Visual directions exist but one must be selected before asset generation.',
      ['No visual direction is selected.'],
      ['Review visual directions.', 'Select the strongest direction.'],
      [action('NAVIGATE_STAGE', 'Select visual direction', 'VISUALS', 'primary')]
    );
  }

  return item('VISUALS', 'Visual Director', 'READY', 'Visual Director is ready to generate directions.', [], ['Generate visual directions.'], [
    action('RUN_VISUAL_DIRECTIONS', 'Generate visual directions', 'VISUALS', 'primary')
  ]);
}

function readinessForAssets(
  stageStatus: string | undefined,
  facts: Record<string, unknown>,
  running: boolean
): IdentityStageReadinessItem {
  if (!booleanFact(facts.visual_direction_selected)) {
    return item('ASSETS', 'Logo Designer', 'BLOCKED', 'Assets are blocked until a visual direction is selected.', ['No selected visual direction.'], ['Select a visual direction first.'], [
      action('NAVIGATE_STAGE', 'Select visual direction', 'VISUALS', 'primary')
    ]);
  }

  if (running && stageStatus === 'GENERATING') {
    return item('ASSETS', 'Logo Designer', 'IN_PROGRESS', 'Asset AI work is running.', [], ['Wait for asset generation to finish.'], [
      action('REFRESH_READINESS', 'Refresh status', 'ASSETS', 'secondary')
    ]);
  }

  if (booleanFact(facts.logo_concept_selected)) {
    return item('ASSETS', 'Logo Designer', 'COMPLETE', 'A logo concept is selected and ready for finalization.', [], ['Move to Finalize.'], [
      action('NAVIGATE_STAGE', 'Move to Finalize', 'FINALIZE', 'primary')
    ]);
  }

  if (booleanFact(facts.logo_concept_exists)) {
    return item(
      'ASSETS',
      'Logo Designer',
      'NEEDS_INPUT',
      'Logo concepts exist but one must be shortlisted or selected.',
      ['No logo concept is selected.'],
      ['Review generated logo concepts.', 'Shortlist/select the strongest option.'],
      [action('NAVIGATE_STAGE', 'Review logo concepts', 'ASSETS', 'primary')]
    );
  }

  return item('ASSETS', 'Logo Designer', 'READY', 'Logo Designer is ready to generate brand assets.', [], ['Generate logo concepts.'], [
    action('RUN_LOGO_CONCEPTS', 'Generate 3 logo concepts', 'ASSETS', 'primary')
  ]);
}

function readinessForFinalize(
  stageStatus: string | undefined,
  facts: Record<string, unknown>,
  running: boolean
): IdentityStageReadinessItem {
  if (!booleanFact(facts.visual_direction_selected) || !booleanFact(facts.logo_concept_selected)) {
    return item(
      'FINALIZE',
      'Brand Book Writer',
      'BLOCKED',
      'Finalize is blocked until visual and logo selections are complete.',
      ['Selected visual direction and selected logo concept are required.'],
      ['Complete Visuals and Assets first.'],
      [action('NAVIGATE_STAGE', 'Open Assets', 'ASSETS', 'primary')]
    );
  }

  if (running && stageStatus === 'GENERATING') {
    return item('FINALIZE', 'Brand Book Writer', 'IN_PROGRESS', 'Finalization AI work is running.', [], ['Wait for finalization to finish.'], [
      action('REFRESH_READINESS', 'Refresh status', 'FINALIZE', 'secondary')
    ]);
  }

  if (booleanFact(facts.brand_book_ready) && String(facts.version_status) === 'ACTIVE') {
    return item('FINALIZE', 'Brand Book Writer', 'COMPLETE', 'Brand identity is active and ready for other AI employees.', [], ['Use this approved brand context in downstream work.'], [
      action('NAVIGATE_STAGE', 'Open final brand book', 'FINALIZE', 'primary')
    ]);
  }

  if (booleanFact(facts.brand_book_ready)) {
    return item(
      'FINALIZE',
      'Brand Book Writer',
      'NEEDS_INPUT',
      'Brand book is ready and needs agency approval/activation.',
      ['Brand book exists but this identity version is not active.'],
      ['Review the brand book.', 'Approve and activate this identity when ready.'],
      [action('NAVIGATE_STAGE', 'Review and approve', 'FINALIZE', 'primary')]
    );
  }

  return item('FINALIZE', 'Brand Book Writer', 'READY', 'Brand Book Writer is ready to generate the final brand book.', [], ['Generate brand book.'], [
    action('RUN_BRAND_BOOK', 'Generate brand book', 'FINALIZE', 'primary')
  ]);
}

function item(
  stageKey: string,
  employeeRole: string,
  status: IdentityStageReadinessItem['status'],
  summary: string,
  reasons: string[],
  recommendedActions: string[],
  actions: IdentityStageReadinessAction[] = []
): IdentityStageReadinessItem {
  return {
    stage_key: stageKey,
    employee_role: employeeRole,
    status,
    summary,
    reasons,
    recommended_actions: recommendedActions,
    actions
  };
}

function booleanFact(value: unknown): boolean {
  return value === true || value === 'true';
}

function normalizeStageKey(value: string | undefined): string | null {
  if (!value) return null;
  return ['BRIEF', 'STRATEGY', 'VISUALS', 'ASSETS', 'FINALIZE'].includes(value) ? value : null;
}

const serverAutopilotGenerationActions = new Set<IdentityStageReadinessAction['code']>([
  'RUN_COMPETITOR_RESEARCH',
  'RUN_STRATEGY_GENERATION',
  'RUN_VISUAL_DIRECTIONS',
  'RUN_LOGO_CONCEPTS',
  'RUN_BRAND_BOOK'
]);

function isServerAutopilotGenerationAction(action: IdentityStageReadinessAction): boolean {
  return serverAutopilotGenerationActions.has(action.code);
}

function selectNextServerAutopilotAction(items: IdentityStageReadinessItem[]): IdentityStageReadinessAction | null {
  const stageOrder = ['BRIEF', 'STRATEGY', 'VISUALS', 'ASSETS', 'FINALIZE'];

  for (const stageKey of stageOrder) {
    const item = items.find((candidate) => candidate.stage_key === stageKey);
    if (!item || item.status === 'COMPLETE') continue;
    if (item.status === 'IN_PROGRESS') return item.actions.find((candidate) => candidate.code === 'REFRESH_READINESS') ?? null;

    const primaryGenerationAction = item.actions.find(
      (candidate) => candidate.style === 'primary' && isServerAutopilotGenerationAction(candidate)
    );
    if (primaryGenerationAction) return primaryGenerationAction;

    const humanGateAction = item.actions.find((candidate) => candidate.code === 'NAVIGATE_STAGE');
    if (humanGateAction) return humanGateAction;
  }

  return null;
}

function generationDtoForAutopilotAction(
  workspaceId: string,
  versionId: string,
  actionItem: IdentityStageReadinessAction
) {
  if (actionItem.code === 'RUN_COMPETITOR_RESEARCH') {
    return {
      workspaceId,
      identityVersionId: versionId,
      workflowStageKey: WorkflowStageKey.Strategy,
      task: GenerationTask.CompetitorResearch,
      tier: AiGenerationTier.Balanced,
      input: {
        competitorNames: [],
        market: '',
        maxCompetitors: 5,
        userInstructions: ''
      }
    };
  }

  if (actionItem.code === 'RUN_STRATEGY_GENERATION') {
    return {
      workspaceId,
      identityVersionId: versionId,
      workflowStageKey: WorkflowStageKey.Strategy,
      task: GenerationTask.StrategyGenerate,
      tier: AiGenerationTier.Balanced,
      input: {
        mode: 'full',
        userInstructions: ''
      }
    };
  }

  if (actionItem.code === 'RUN_VISUAL_DIRECTIONS') {
    return {
      workspaceId,
      identityVersionId: versionId,
      workflowStageKey: WorkflowStageKey.Visuals,
      task: GenerationTask.VisualDirectionsGenerate,
      tier: AiGenerationTier.Balanced,
      input: {
        mode: 'batch',
        userInstructions: ''
      }
    };
  }

  if (actionItem.code === 'RUN_LOGO_CONCEPTS') {
    return {
      workspaceId,
      identityVersionId: versionId,
      workflowStageKey: WorkflowStageKey.Assets,
      task: GenerationTask.LogoConceptsGenerate,
      tier: AiGenerationTier.Balanced,
      input: {
        count: 3,
        languageCodes: [],
        useCase: 'primary brand identity',
        userInstructions: ''
      }
    };
  }

  throw new DomainError('AUTOPILOT_ACTION_UNSUPPORTED', `Unsupported Autopilot action: ${actionItem.code}.`, 500);
}

function action(
  code: IdentityStageReadinessAction['code'],
  label: string,
  stageKey: string,
  style: IdentityStageReadinessAction['style']
): IdentityStageReadinessAction {
  return {
    code,
    label,
    stage_key: stageKey,
    style
  };
}
