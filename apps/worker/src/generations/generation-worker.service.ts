import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { Queue, Worker } from 'bullmq';
import type { Job } from 'bullmq';
import type { DataSource } from 'typeorm';
import { redisConnectionOptions } from './redis-connection-options.js';
import { StageGeneratorFactory } from './stage-generator.factory.js';

const queueName = 'brand-identity-generations';
const terminalStatuses = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED']);

interface GenerationQueuePayload {
  jobId: string;
}

interface GenerationJobRow {
  id: string;
  identity_version_id: string;
  brand_context_package_id: string | null;
  brand_context_package_checksum_sha256: string | null;
  brand_context_package_json?: Record<string, unknown> | null;
  workflow_stage_key: string;
  task: string;
  tier: string;
  status: string;
  input: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

@Injectable()
export class GenerationWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GenerationWorkerService.name);
  private worker?: Worker<GenerationQueuePayload>;
  private queue?: Queue<GenerationQueuePayload>;

  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(StageGeneratorFactory)
    private readonly generators: StageGeneratorFactory
  ) {}

  onModuleInit(): void {
    this.queue = new Queue(queueName, {
      connection: redisConnectionOptions(this.config.getOrThrow<string>('REDIS_URL'))
    });
    this.worker = new Worker<GenerationQueuePayload>(
      queueName,
      (job) => this.process(job),
      {
        connection: redisConnectionOptions(this.config.getOrThrow<string>('REDIS_URL')),
        concurrency: this.config.get<number>('WORKER_CONCURRENCY') ?? 2,
        stalledInterval: 30_000,
        maxStalledCount: 2
      }
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Generation queue job ${job?.id ?? 'unknown'} failed: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  private async process(queueJob: Job<GenerationQueuePayload>): Promise<void> {
    const { job, runId, attemptNumber } = await this.startAttempt(queueJob.data.jobId);

    if (terminalStatuses.has(job.status)) {
      return;
    }

    if (job.status === 'CANCEL_REQUESTED') {
      await this.cancelBeforeCharge(job.id, runId);
      return;
    }

    try {
      const generator = this.generators.resolve(job.task);
      const result = await generator.generate({
        id: job.id,
        identityVersionId: job.identity_version_id,
        brandContextPackageId: job.brand_context_package_id,
        brandContextPackageChecksumSha256: job.brand_context_package_checksum_sha256,
        brandContextPackage: job.brand_context_package_json ?? null,
        workflowStageKey: job.workflow_stage_key,
        task: job.task,
        tier: job.tier,
        input: job.input
      });

      await this.dataSource.transaction(async (manager) => {
        const latestRows = await manager.query<GenerationJobRow[]>(`SELECT * FROM generation_jobs WHERE id = $1 FOR UPDATE`, [
          job.id
        ]);
        const latest = latestRows[0];

        if (!latest || terminalStatuses.has(latest.status)) {
          return;
        }

        if (result.persist) {
          await result.persist(manager);
        }

        await manager.query(
          `INSERT INTO generation_artifacts (
            generation_job_id, ai_generation_run_id, identity_version_id, workflow_stage_key,
            kind, name, content_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
          [
            latest.id,
            runId,
            latest.identity_version_id,
            latest.workflow_stage_key,
            result.artifactKind,
            result.artifactName,
            JSON.stringify(result.contentJson)
          ]
        );
        const handoff = buildAiEmployeeHandoff(latest, result.contentJson);
        await manager.query(
          `UPDATE ai_employee_handoffs
           SET is_current = false, updated_at = now()
           WHERE identity_version_id = $1
             AND from_stage_key = $2
             AND task = $3
             AND is_current`,
          [latest.identity_version_id, latest.workflow_stage_key, latest.task]
        );
        await manager.query(
          `INSERT INTO ai_employee_handoffs (
            identity_version_id, generation_job_id, from_stage_key, to_stage_key, task,
            employee_role, summary, notes, recommendations, is_current
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, true)`,
          [
            latest.identity_version_id,
            latest.id,
            latest.workflow_stage_key,
            handoff.toStageKey,
            latest.task,
            handoff.employeeRole,
            handoff.summary,
            JSON.stringify(handoff.notes),
            JSON.stringify(handoff.recommendations)
          ]
        );
        await manager.query(
          `UPDATE ai_generation_runs
           SET status = 'SUCCEEDED', sanitized_request = $1::jsonb, parsed_response = $2::jsonb,
               actual_model = $3, actual_provider = $4, prompt_tokens = $5, completion_tokens = $6,
               total_tokens = $7, estimated_cost_micro_usd = $8, latency_ms = $9, completed_at = now()
           WHERE id = $10`,
          [
            JSON.stringify(result.sanitizedRequest),
            JSON.stringify(result.parsedResponse),
            result.actualModel ?? null,
            result.actualProvider ?? null,
            result.promptTokens ?? 0,
            result.completionTokens ?? 0,
            result.totalTokens ?? 0,
            result.estimatedCostMicroUsd ?? 0,
            result.latencyMs ?? null,
            runId
          ]
        );
        await manager.query(
          `UPDATE generation_jobs
           SET status = 'SUCCEEDED', progress_percent = 100, progress_message = 'Generation completed.',
               completed_at = now(), failed_at = NULL, error_code = NULL, error_message = NULL, error_details = NULL,
               heartbeat_at = now(), updated_at = now()
           WHERE id = $1`,
          [latest.id]
        );
        await manager.query(
          `UPDATE workflow_stages
           SET status = 'READY', completion_percent = 100, updated_at = now()
           WHERE identity_version_id = $1 AND stage_key = $2`,
          [latest.identity_version_id, latest.workflow_stage_key]
        );
        if (latest.workflow_stage_key === 'ASSETS') {
          await manager.query(
            `UPDATE workflow_stages
             SET status = 'NOT_STARTED', updated_at = now()
             WHERE identity_version_id = $1 AND stage_key = 'FINALIZE' AND status IN ('LOCKED', 'STALE')`,
            [latest.identity_version_id]
          );
        }
      });
      await this.continueAutopilotAfterSuccessfulGeneration(job.id);
    } catch (error) {
      await this.failAttempt(job.id, runId, attemptNumber, error);
      throw error;
    }
  }

  private async continueAutopilotAfterSuccessfulGeneration(generationJobId: string): Promise<void> {
    const rows = await this.dataSource.query<
      Array<{
        run_id: string;
        workspace_id: string;
        identity_project_id: string;
        identity_version_id: string;
        started_by_user_id: string | null;
        completed_steps: number;
        stage_key: string | null;
        action_code: string | null;
      }>
    >(
      `SELECT runs.id AS run_id,
              runs.workspace_id,
              runs.identity_project_id,
              runs.identity_version_id,
              runs.started_by_user_id,
              runs.completed_steps,
              started.stage_key,
              started.action_code
       FROM ai_employee_autopilot_events started
       JOIN ai_employee_autopilot_runs runs ON runs.id = started.autopilot_run_id
       WHERE started.generation_job_id = $1::uuid
         AND started.event_type = 'ACTION_STARTED'
         AND runs.status = 'RUNNING'
       ORDER BY started.created_at DESC
       LIMIT 1`,
      [generationJobId]
    );
    const run = rows[0];
    if (!run) return;

    await this.recordAutopilotActionSucceeded(run.run_id, generationJobId, run.stage_key, run.action_code);
    const nextAction = await this.selectNextAutopilotAction(run.identity_version_id);

    if (!nextAction) {
      await this.completeAutopilotRun(run.run_id, 'Autopilot found no more safe automatic actions.');
      return;
    }

    if (nextAction.code === 'REFRESH_READINESS') {
      return;
    }

    if (!isWorkerAutopilotGenerationAction(nextAction.code)) {
      await this.pauseAutopilotRun(
        run.run_id,
        nextAction.stageKey,
        nextAction.code,
        `Autopilot paused at ${nextAction.stageKey}: ${nextAction.label}. Human review is required.`
      );
      return;
    }

    const nextJobId = await this.enqueueAutopilotGeneration(run, nextAction);
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
       VALUES ($1::uuid, $2::uuid, 'ACTION_STARTED', $3::workflow_stage_key, $4, $5, '{}'::jsonb)`,
      [run.run_id, nextJobId, nextAction.stageKey, nextAction.code, `${nextAction.label} queued.`]
    );
  }

  private async recordAutopilotActionSucceeded(
    runId: string,
    generationJobId: string,
    stageKey: string | null,
    actionCode: string | null
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.query<{ id: string }[]>(
        `SELECT id
         FROM ai_employee_autopilot_events
         WHERE autopilot_run_id = $1::uuid
           AND generation_job_id = $2::uuid
           AND event_type = 'ACTION_SUCCEEDED'`,
        [runId, generationJobId]
      );
      if (existing[0]) return;

      await manager.query(
        `INSERT INTO ai_employee_autopilot_events (
           autopilot_run_id,
           generation_job_id,
           event_type,
           stage_key,
           action_code,
           message,
           metadata
         )
         VALUES ($1::uuid, $2::uuid, 'ACTION_SUCCEEDED', $3::workflow_stage_key, $4, $5, '{}'::jsonb)`,
        [runId, generationJobId, normalizeWorkerStageKey(stageKey), actionCode, `${actionCode ?? 'Autopilot action'} completed.`]
      );
      await manager.query(
        `UPDATE ai_employee_autopilot_runs
         SET completed_steps = completed_steps + 1,
             current_stage_key = COALESCE($2::workflow_stage_key, current_stage_key),
             last_action_code = COALESCE($3, last_action_code),
             updated_at = now()
         WHERE id = $1::uuid`,
        [runId, normalizeWorkerStageKey(stageKey), actionCode]
      );
    });
  }

  private async selectNextAutopilotAction(identityVersionId: string): Promise<WorkerAutopilotAction | null> {
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
      [identityVersionId]
    );
    const facts = rows[0] ?? {};
    const stageStatuses = (facts.stage_statuses ?? {}) as Record<string, string>;
    const running = booleanWorkerFact(facts.has_running_job);

    if (!booleanWorkerFact(facts.brief_confirmed)) {
      return navigateWorkerAction('BRIEF', 'Complete Brief');
    }

    if (!booleanWorkerFact(facts.strategy_confirmed)) {
      if (running && stageStatuses.STRATEGY === 'GENERATING') return refreshWorkerAction('STRATEGY');
      if (!booleanWorkerFact(facts.competitor_research_ready)) return generationWorkerAction('STRATEGY', 'RUN_COMPETITOR_RESEARCH', 'Run competitor research');
      if (booleanWorkerFact(facts.strategy_complete)) return navigateWorkerAction('STRATEGY', 'Review strategy');
      return generationWorkerAction('STRATEGY', 'RUN_STRATEGY_GENERATION', 'Generate strategy');
    }

    if (!booleanWorkerFact(facts.visual_direction_selected)) {
      if (running && stageStatuses.VISUALS === 'GENERATING') return refreshWorkerAction('VISUALS');
      if (booleanWorkerFact(facts.visual_direction_exists)) return navigateWorkerAction('VISUALS', 'Select visual direction');
      return generationWorkerAction('VISUALS', 'RUN_VISUAL_DIRECTIONS', 'Generate visual directions');
    }

    if (!booleanWorkerFact(facts.logo_concept_selected)) {
      if (running && stageStatuses.ASSETS === 'GENERATING') return refreshWorkerAction('ASSETS');
      if (booleanWorkerFact(facts.logo_concept_exists)) return navigateWorkerAction('ASSETS', 'Review logo concepts');
      return generationWorkerAction('ASSETS', 'RUN_LOGO_CONCEPTS', 'Generate 3 logo concepts');
    }

    if (!booleanWorkerFact(facts.brand_book_ready)) {
      return generationWorkerAction('FINALIZE', 'RUN_BRAND_BOOK', 'Generate brand book');
    }

    if (String(facts.version_status) !== 'ACTIVE') {
      return navigateWorkerAction('FINALIZE', 'Review and approve');
    }

    return null;
  }

  private async enqueueAutopilotGeneration(
    run: {
      run_id: string;
      workspace_id: string;
      identity_project_id: string;
      identity_version_id: string;
      started_by_user_id: string | null;
      completed_steps: number;
    },
    action: WorkerAutopilotAction
  ): Promise<string> {
    if (!run.started_by_user_id) {
      throw new Error('Autopilot run has no starting user.');
    }
    if (!this.queue) {
      throw new Error('Generation queue is not available.');
    }

    const dto = workerGenerationDto(run.workspace_id, run.identity_version_id, action);
    const idempotencyKey = `autopilot-${run.run_id}-${run.completed_steps + 1}-${action.code}`;
    const jobId = await this.dataSource.transaction(async (manager) => {
      const existingRows = await manager.query<{ id: string; bullmq_job_id: string | null }[]>(
        `SELECT id, bullmq_job_id FROM generation_jobs WHERE workspace_id = $1::uuid AND idempotency_key = $2`,
        [run.workspace_id, idempotencyKey]
      );
      if (existingRows[0]) return existingRows[0].id;

      const versionRows = await manager.query<
        Array<{
          active_version_id: string | null;
          active_context_package_id: string | null;
          active_context_package_checksum_sha256: string | null;
        }>
      >(
        `SELECT identity_projects.active_version_id,
                identity_projects.active_context_package_id,
                brand_context_packages.checksum_sha256 AS active_context_package_checksum_sha256
         FROM identity_versions
         JOIN identity_projects ON identity_projects.id = identity_versions.identity_project_id
         LEFT JOIN brand_context_packages
           ON brand_context_packages.id = identity_projects.active_context_package_id
          AND brand_context_packages.status = 'PUBLISHED'
         WHERE identity_versions.id = $1::uuid
           AND identity_projects.workspace_id = $2::uuid
           AND identity_projects.status = 'ACTIVE'`,
        [run.identity_version_id, run.workspace_id]
      );
      const versionPin = versionRows[0];
      const brandContextPackageId =
        versionPin?.active_version_id === run.identity_version_id ? versionPin.active_context_package_id : null;
      const brandContextPackageChecksumSha256 = brandContextPackageId
        ? versionPin?.active_context_package_checksum_sha256
        : null;
      const insertedRows = await manager.query<{ id: string }[]>(
        `INSERT INTO generation_jobs (
          workspace_id, identity_version_id, workflow_stage_key, task, tier, idempotency_key,
          requested_by_user_id, input, brand_context_package_id, brand_context_package_checksum_sha256,
          progress_percent, progress_message, max_attempts
        )
        VALUES ($1::uuid, $2::uuid, $3::workflow_stage_key, $4::generation_task, 'BALANCED', $5,
                $6::uuid, $7::jsonb, $8::uuid, $9, 5, 'Queued by AI Employee Autopilot.', 2)
        RETURNING id`,
        [
          run.workspace_id,
          run.identity_version_id,
          dto.workflowStageKey,
          dto.task,
          idempotencyKey,
          run.started_by_user_id,
          JSON.stringify(dto.input),
          brandContextPackageId,
          brandContextPackageChecksumSha256
        ]
      );
      const inserted = insertedRows[0]?.id as string;
      await manager.query(
        `UPDATE workflow_stages
         SET status = 'GENERATING', completion_percent = 5, last_generation_job_id = $2::uuid, updated_at = now()
         WHERE identity_version_id = $1::uuid AND stage_key = $3::workflow_stage_key`,
        [run.identity_version_id, inserted, dto.workflowStageKey]
      );
      return inserted;
    });

    const queuedJob = await this.queue.add(
      'generation',
      { jobId },
      {
        jobId,
        attempts: 2,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: false,
        removeOnFail: false
      }
    );
    await this.dataSource.query(`UPDATE generation_jobs SET bullmq_job_id = $1, updated_at = now() WHERE id = $2`, [
      String(queuedJob.id),
      jobId
    ]);
    return jobId;
  }

  private async pauseAutopilotRun(runId: string, stageKey: string, actionCode: string, reason: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE ai_employee_autopilot_runs
         SET status = 'PAUSED',
             current_stage_key = $2::workflow_stage_key,
             last_action_code = $3,
             pause_reason = $4,
             paused_at = now(),
             updated_at = now()
         WHERE id = $1::uuid`,
        [runId, stageKey, actionCode, reason]
      );
      await manager.query(
        `INSERT INTO ai_employee_autopilot_events (
           autopilot_run_id,
           event_type,
           stage_key,
           action_code,
           message,
           metadata
         )
         VALUES ($1::uuid, 'PAUSED', $2::workflow_stage_key, $3, $4, '{}'::jsonb)`,
        [runId, stageKey, actionCode, reason]
      );
    });
  }

  private async completeAutopilotRun(runId: string, message: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE ai_employee_autopilot_runs
         SET status = 'COMPLETED', completed_at = now(), updated_at = now()
         WHERE id = $1::uuid`,
        [runId]
      );
      await manager.query(
        `INSERT INTO ai_employee_autopilot_events (autopilot_run_id, event_type, message, metadata)
         VALUES ($1::uuid, 'COMPLETED', $2, '{}'::jsonb)`,
        [runId, message]
      );
    });
  }

  private async startAttempt(jobId: string): Promise<{ job: GenerationJobRow; runId: string; attemptNumber: number }> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<GenerationJobRow[]>(
        `SELECT generation_jobs.*,
                brand_context_packages.package_json AS brand_context_package_json
         FROM generation_jobs
         LEFT JOIN brand_context_packages
           ON brand_context_packages.id = generation_jobs.brand_context_package_id
          AND brand_context_packages.checksum_sha256 = generation_jobs.brand_context_package_checksum_sha256
          AND brand_context_packages.status = 'PUBLISHED'
         WHERE generation_jobs.id = $1
         FOR UPDATE OF generation_jobs`,
        [jobId]
      );
      const job = rows[0];

      if (!job) {
        throw new Error(`Generation job ${jobId} was not found.`);
      }

      if (terminalStatuses.has(job.status)) {
        return { job, runId: '00000000-0000-0000-0000-000000000000', attemptNumber: job.attempts };
      }

      const attemptNumber = job.attempts + 1;
      await manager.query(
        `UPDATE generation_jobs
         SET status = CASE WHEN status = 'CANCEL_REQUESTED' THEN status ELSE 'RUNNING' END,
             attempts = $1, started_at = COALESCE(started_at, now()), heartbeat_at = now(),
             progress_percent = GREATEST(progress_percent, 10), progress_message = 'Generation running.',
             error_code = NULL, error_message = NULL, error_details = NULL, failed_at = NULL, updated_at = now()
         WHERE id = $2`,
        [attemptNumber, job.id]
      );
      const runRows = await manager.query<{ id: string }[]>(
        `INSERT INTO ai_generation_runs (
          generation_job_id, attempt_number, status, sanitized_request,
          brand_context_package_id, brand_context_package_checksum_sha256
        )
         VALUES ($1, $2, 'RUNNING', '{}'::jsonb, $3::uuid, $4)
         RETURNING id`,
        [job.id, attemptNumber, job.brand_context_package_id, job.brand_context_package_checksum_sha256]
      );

      return { job: { ...job, attempts: attemptNumber }, runId: runRows[0]?.id as string, attemptNumber };
    });
  }

  private async cancelBeforeCharge(jobId: string, runId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`UPDATE ai_generation_runs SET status = 'CANCELLED', completed_at = now() WHERE id = $1`, [runId]);
      await manager.query(
        `UPDATE generation_jobs
         SET status = 'CANCELLED', progress_message = 'Cancelled before provider request.',
             completed_at = now(), updated_at = now()
         WHERE id = $1 AND status = 'CANCEL_REQUESTED'`,
        [jobId]
      );
    });
  }

  private async failAttempt(jobId: string, runId: string, attemptNumber: number, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : 'Unknown generation failure.';

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE ai_generation_runs
         SET status = 'FAILED', error = $1::jsonb, completed_at = now()
         WHERE id = $2`,
        [JSON.stringify({ message }), runId]
      );
      await manager.query(
        `UPDATE generation_jobs
         SET status = CASE WHEN $1 >= max_attempts THEN 'FAILED' ELSE status END,
             failed_at = CASE WHEN $1 >= max_attempts THEN now() ELSE failed_at END,
             error_code = 'GENERATION_WORKER_ERROR',
             error_message = $2,
             progress_message = CASE WHEN $1 >= max_attempts THEN 'Generation failed.' ELSE 'Generation will retry.' END,
             heartbeat_at = now(),
             updated_at = now()
         WHERE id = $3`,
        [attemptNumber, message, jobId]
      );
      await manager.query(
        `UPDATE workflow_stages
         SET status = 'FAILED', updated_at = now()
         FROM generation_jobs
         WHERE generation_jobs.id = $2
           AND $1::integer >= generation_jobs.max_attempts
           AND workflow_stages.identity_version_id = generation_jobs.identity_version_id
           AND workflow_stages.stage_key = generation_jobs.workflow_stage_key
           AND workflow_stages.last_generation_job_id = generation_jobs.id`,
        [attemptNumber, jobId]
      );
    });
  }
}

type WorkerAutopilotAction = {
  stageKey: 'BRIEF' | 'STRATEGY' | 'VISUALS' | 'ASSETS' | 'FINALIZE';
  code:
    | 'NAVIGATE_STAGE'
    | 'REFRESH_READINESS'
    | 'RUN_COMPETITOR_RESEARCH'
    | 'RUN_STRATEGY_GENERATION'
    | 'RUN_VISUAL_DIRECTIONS'
    | 'RUN_LOGO_CONCEPTS'
    | 'RUN_BRAND_BOOK';
  label: string;
};

function generationWorkerAction(stageKey: WorkerAutopilotAction['stageKey'], code: WorkerAutopilotAction['code'], label: string) {
  return { stageKey, code, label };
}

function navigateWorkerAction(stageKey: WorkerAutopilotAction['stageKey'], label: string) {
  return { stageKey, code: 'NAVIGATE_STAGE' as const, label };
}

function refreshWorkerAction(stageKey: WorkerAutopilotAction['stageKey']) {
  return { stageKey, code: 'REFRESH_READINESS' as const, label: 'Refresh readiness' };
}

function isWorkerAutopilotGenerationAction(code: WorkerAutopilotAction['code']): boolean {
  return [
    'RUN_COMPETITOR_RESEARCH',
    'RUN_STRATEGY_GENERATION',
    'RUN_VISUAL_DIRECTIONS',
    'RUN_LOGO_CONCEPTS'
  ].includes(code);
}

function workerGenerationDto(workspaceId: string, identityVersionId: string, action: WorkerAutopilotAction) {
  if (action.code === 'RUN_COMPETITOR_RESEARCH') {
    return {
      workspaceId,
      identityVersionId,
      workflowStageKey: 'STRATEGY',
      task: 'COMPETITOR_RESEARCH',
      input: { competitorNames: [], market: '', maxCompetitors: 5, userInstructions: '' }
    };
  }

  if (action.code === 'RUN_STRATEGY_GENERATION') {
    return {
      workspaceId,
      identityVersionId,
      workflowStageKey: 'STRATEGY',
      task: 'STRATEGY_GENERATE',
      input: { mode: 'full', userInstructions: '' }
    };
  }

  if (action.code === 'RUN_VISUAL_DIRECTIONS') {
    return {
      workspaceId,
      identityVersionId,
      workflowStageKey: 'VISUALS',
      task: 'VISUAL_DIRECTIONS_GENERATE',
      input: { mode: 'batch', userInstructions: '' }
    };
  }

  if (action.code === 'RUN_LOGO_CONCEPTS') {
    return {
      workspaceId,
      identityVersionId,
      workflowStageKey: 'ASSETS',
      task: 'LOGO_CONCEPTS_GENERATE',
      input: { count: 3, languageCodes: [], useCase: 'primary brand identity', userInstructions: '' }
    };
  }

  throw new Error(`Unsupported worker Autopilot action: ${action.code}`);
}

function booleanWorkerFact(value: unknown): boolean {
  return value === true || value === 'true';
}

function normalizeWorkerStageKey(value: string | null): string | null {
  if (!value) return null;
  return ['BRIEF', 'STRATEGY', 'VISUALS', 'ASSETS', 'FINALIZE'].includes(value) ? value : null;
}

function buildAiEmployeeHandoff(job: GenerationJobRow, contentJson: Record<string, unknown>) {
  const role = employeeRoleForTask(job.task);
  const toStageKey = nextStageForTask(job.task);
  const notes = notesForTask(job.task, contentJson);
  const recommendations = recommendationsForTask(job.task, contentJson);

  return {
    employeeRole: role,
    toStageKey,
    summary: summaryForTask(job.task, contentJson),
    notes,
    recommendations
  };
}

function employeeRoleForTask(task: string): string {
  const roles: Record<string, string> = {
    BRIEF_EXTRACT: 'Brief Analyst',
    BRIEF_IMPROVE: 'Brief Analyst',
    COMPETITOR_RESEARCH: 'Research Strategist',
    STRATEGY_GENERATE: 'Strategy Writer',
    STRATEGY_SECTION_REGENERATE: 'Strategy Writer',
    VISUAL_DIRECTIONS_GENERATE: 'Visual Director',
    VISUAL_VARIATION_GENERATE: 'Visual Director',
    LOGO_CONCEPTS_GENERATE: 'Logo Designer',
    BRAND_BOOK_NARRATIVE_GENERATE: 'Brand Book Writer',
    QUALITY_REVIEW: 'Quality Reviewer'
  };

  return roles[task] ?? 'AI Employee';
}

function nextStageForTask(task: string): string | null {
  if (task === 'BRIEF_EXTRACT' || task === 'BRIEF_IMPROVE') return 'STRATEGY';
  if (task === 'COMPETITOR_RESEARCH') return 'STRATEGY';
  if (task === 'STRATEGY_GENERATE' || task === 'STRATEGY_SECTION_REGENERATE') return 'VISUALS';
  if (task === 'VISUAL_DIRECTIONS_GENERATE' || task === 'VISUAL_VARIATION_GENERATE') return 'ASSETS';
  if (task === 'LOGO_CONCEPTS_GENERATE') return 'FINALIZE';
  return null;
}

function summaryForTask(task: string, contentJson: Record<string, unknown>): string {
  if (task === 'COMPETITOR_RESEARCH') {
    return textValue(contentJson.summary) || 'Competitor research is ready for strategy work.';
  }

  if (task === 'STRATEGY_GENERATE' || task === 'STRATEGY_SECTION_REGENERATE') {
    return textValue(contentJson.positioning) || 'Strategy work is ready for visual direction.';
  }

  if (task === 'VISUAL_DIRECTIONS_GENERATE' || task === 'VISUAL_VARIATION_GENERATE') {
    const directions = Array.isArray(contentJson.directions) ? contentJson.directions.length : 0;
    return directions ? `${directions} visual direction option${directions === 1 ? '' : 's'} prepared for asset generation.` : 'Visual direction is ready for asset generation.';
  }

  if (task === 'LOGO_CONCEPTS_GENERATE') {
    const concepts = Array.isArray(contentJson.concepts) ? contentJson.concepts.length : 0;
    return concepts ? `${concepts} logo concept option${concepts === 1 ? '' : 's'} prepared for selection.` : 'Logo concepts are ready for review.';
  }

  if (task === 'QUALITY_REVIEW') {
    return `Quality review completed with score ${textValue(contentJson.score) || 'unknown'}.`;
  }

  return 'AI employee work completed and is ready for the next step.';
}

function notesForTask(task: string, contentJson: Record<string, unknown>): string[] {
  if (task === 'COMPETITOR_RESEARCH') {
    return [
      boundedListItem(contentJson, 'searchQueries', 'Search queries captured.'),
      boundedListItem(contentJson, 'limitations', 'Research limitations captured.'),
      competitorsNote(contentJson)
    ].filter(Boolean);
  }

  if (task === 'STRATEGY_GENERATE' || task === 'STRATEGY_SECTION_REGENERATE') {
    return [
      textValue(contentJson.valueProposition) ? `Value proposition: ${textValue(contentJson.valueProposition)}` : '',
      boundedListItem(contentJson, 'values', 'Values generated.'),
      boundedListItem(contentJson, 'taglines', 'Tagline options generated.')
    ].filter(Boolean);
  }

  if (task === 'VISUAL_DIRECTIONS_GENERATE' || task === 'VISUAL_VARIATION_GENERATE') {
    return visualDirectionNotes(contentJson);
  }

  if (task === 'LOGO_CONCEPTS_GENERATE') {
    return logoConceptNotes(contentJson);
  }

  return [];
}

function recommendationsForTask(task: string, contentJson: Record<string, unknown>): string[] {
  if (task === 'COMPETITOR_RESEARCH') {
    return ['Use cited competitor differences to sharpen positioning.', 'Avoid claims that were not supported by citations.'];
  }

  if (task === 'STRATEGY_GENERATE' || task === 'STRATEGY_SECTION_REGENERATE') {
    return ['Select or refine the strongest tagline before visuals.', 'Use the positioning and values as visual decision filters.'];
  }

  if (task === 'VISUAL_DIRECTIONS_GENERATE' || task === 'VISUAL_VARIATION_GENERATE') {
    return ['Select one visual direction before generating logos.', 'Carry accessibility and avoid-list notes into asset prompts.'];
  }

  if (task === 'LOGO_CONCEPTS_GENERATE') {
    return ['Shortlist one logo concept before finalizing.', 'Run trademark/legal review before production use.'];
  }

  if (task === 'QUALITY_REVIEW') {
    const approved = contentJson.approved === true;
    return approved ? ['Ready for agency approval or final export.'] : ['Resolve quality-review issues before approval.'];
  }

  return ['Review this output before moving to the next workflow step.'];
}

function boundedListItem(contentJson: Record<string, unknown>, key: string, fallback: string): string {
  const value = contentJson[key];
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return `${fallback} ${value.slice(0, 3).map((item) => String(item)).join(' · ')}`;
}

function competitorsNote(contentJson: Record<string, unknown>): string {
  const competitors = contentJson.competitors;
  if (!Array.isArray(competitors) || competitors.length === 0) return 'No competitors were returned.';
  const names = competitors
    .slice(0, 5)
    .map((item) => (typeof item === 'object' && item ? textValue((item as Record<string, unknown>).name) : ''))
    .filter(Boolean);
  return names.length ? `Competitors reviewed: ${names.join(', ')}.` : 'Competitor profiles were returned.';
}

function visualDirectionNotes(contentJson: Record<string, unknown>): string[] {
  const directions = contentJson.directions;
  if (!Array.isArray(directions)) return [];

  return directions.slice(0, 3).map((item) => {
    const direction = typeof item === 'object' && item ? (item as Record<string, unknown>) : {};
    const name = textValue(direction.name) || 'Visual direction';
    const thesis = textValue(direction.thesis) || textValue(direction.rationale) || 'No thesis returned.';
    return `${name}: ${thesis}`;
  });
}

function logoConceptNotes(contentJson: Record<string, unknown>): string[] {
  const concepts = contentJson.concepts;
  if (!Array.isArray(concepts)) return [];

  return concepts.slice(0, 3).map((item) => {
    const concept = typeof item === 'object' && item ? (item as Record<string, unknown>) : {};
    const title = textValue(concept.title) || textValue(concept.name) || 'Logo concept';
    const rationale = textValue(concept.rationale) || 'No rationale returned.';
    return `${title}: ${rationale}`;
  });
}

function textValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}
