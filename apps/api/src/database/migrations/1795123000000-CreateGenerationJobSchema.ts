import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGenerationJobSchema1795123000000 implements MigrationInterface {
  name = 'CreateGenerationJobSchema1795123000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE generation_job_status AS ENUM (
        'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCEL_REQUESTED', 'CANCELLED', 'STALLED'
      )
    `);
    await queryRunner.query(`CREATE TYPE generation_artifact_kind AS ENUM ('JSON', 'IMAGE', 'FILE', 'BRAND_BOOK')`);

    await queryRunner.query(`
      CREATE TABLE generation_jobs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        identity_version_id uuid NOT NULL REFERENCES identity_versions(id) ON DELETE CASCADE,
        workflow_stage_key workflow_stage_key NOT NULL,
        task generation_task NOT NULL,
        tier varchar(30) NOT NULL DEFAULT 'BALANCED',
        status generation_job_status NOT NULL DEFAULT 'QUEUED',
        idempotency_key varchar(180) NOT NULL,
        requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        input jsonb NOT NULL DEFAULT '{}'::jsonb,
        progress_percent smallint NOT NULL DEFAULT 0,
        progress_message text,
        attempts integer NOT NULL DEFAULT 0,
        max_attempts integer NOT NULL DEFAULT 2,
        bullmq_job_id varchar(180),
        cancellation_requested_at timestamptz,
        started_at timestamptz,
        completed_at timestamptz,
        failed_at timestamptz,
        heartbeat_at timestamptz,
        error_code varchar(120),
        error_message text,
        error_details jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT generation_jobs_tier_allowed CHECK (tier IN ('FAST', 'BALANCED', 'PREMIUM')),
        CONSTRAINT generation_jobs_progress_range CHECK (progress_percent BETWEEN 0 AND 100),
        CONSTRAINT generation_jobs_attempts_range CHECK (attempts >= 0 AND max_attempts BETWEEN 1 AND 5),
        CONSTRAINT generation_jobs_workspace_idempotency_unique UNIQUE (workspace_id, idempotency_key)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_generation_jobs_version_status ON generation_jobs (identity_version_id, status)`);
    await queryRunner.query(`CREATE INDEX ix_generation_jobs_status_heartbeat ON generation_jobs (status, heartbeat_at)`);

    await queryRunner.query(`
      CREATE TABLE ai_generation_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        generation_job_id uuid NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
        attempt_number integer NOT NULL,
        prompt_template_id uuid REFERENCES ai_prompt_templates(id) ON DELETE SET NULL,
        model_policy_id uuid REFERENCES ai_model_policies(id) ON DELETE SET NULL,
        status generation_job_status NOT NULL,
        sanitized_request jsonb NOT NULL DEFAULT '{}'::jsonb,
        parsed_response jsonb,
        actual_model varchar(180),
        actual_provider varchar(180),
        prompt_tokens integer NOT NULL DEFAULT 0,
        completion_tokens integer NOT NULL DEFAULT 0,
        total_tokens integer NOT NULL DEFAULT 0,
        estimated_cost_micro_usd bigint NOT NULL DEFAULT 0,
        latency_ms integer,
        error jsonb,
        started_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        CONSTRAINT ai_generation_runs_attempt_unique UNIQUE (generation_job_id, attempt_number)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_ai_generation_runs_job ON ai_generation_runs (generation_job_id, started_at DESC)`);

    await queryRunner.query(`
      CREATE TABLE generation_artifacts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        generation_job_id uuid NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
        ai_generation_run_id uuid REFERENCES ai_generation_runs(id) ON DELETE SET NULL,
        identity_version_id uuid NOT NULL REFERENCES identity_versions(id) ON DELETE CASCADE,
        workflow_stage_key workflow_stage_key NOT NULL,
        kind generation_artifact_kind NOT NULL,
        name varchar(180) NOT NULL,
        content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        asset_url text,
        checksum_sha256 char(64),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_generation_artifacts_version_stage ON generation_artifacts (identity_version_id, workflow_stage_key)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS generation_artifacts`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_generation_runs`);
    await queryRunner.query(`DROP TABLE IF EXISTS generation_jobs`);
    await queryRunner.query(`DROP TYPE IF EXISTS generation_artifact_kind`);
    await queryRunner.query(`DROP TYPE IF EXISTS generation_job_status`);
  }
}
