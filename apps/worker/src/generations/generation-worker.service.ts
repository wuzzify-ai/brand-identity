import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { Worker } from 'bullmq';
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

  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(StageGeneratorFactory)
    private readonly generators: StageGeneratorFactory
  ) {}

  onModuleInit(): void {
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
    } catch (error) {
      await this.failAttempt(job.id, runId, attemptNumber, error);
      throw error;
    }
  }

  private async startAttempt(jobId: string): Promise<{ job: GenerationJobRow; runId: string; attemptNumber: number }> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<GenerationJobRow[]>(`SELECT * FROM generation_jobs WHERE id = $1 FOR UPDATE`, [jobId]);
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
        `INSERT INTO ai_generation_runs (generation_job_id, attempt_number, status, sanitized_request)
         VALUES ($1, $2, 'RUNNING', '{}'::jsonb)
         RETURNING id`,
        [job.id, attemptNumber]
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
