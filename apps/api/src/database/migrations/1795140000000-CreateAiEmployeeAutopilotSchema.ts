import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiEmployeeAutopilotSchema1795140000000 implements MigrationInterface {
  name = 'CreateAiEmployeeAutopilotSchema1795140000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ai_employee_autopilot_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        identity_project_id uuid NOT NULL REFERENCES identity_projects(id) ON DELETE CASCADE,
        identity_version_id uuid NOT NULL REFERENCES identity_versions(id) ON DELETE CASCADE,
        started_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        status varchar(24) NOT NULL DEFAULT 'RUNNING',
        current_stage_key workflow_stage_key,
        last_action_code varchar(80),
        completed_steps integer NOT NULL DEFAULT 0,
        pause_reason text,
        error_message text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        started_at timestamptz NOT NULL DEFAULT now(),
        paused_at timestamptz,
        completed_at timestamptz,
        failed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ai_employee_autopilot_runs_status_allowed CHECK (status IN ('RUNNING', 'PAUSED', 'COMPLETED', 'FAILED')),
        CONSTRAINT ai_employee_autopilot_runs_completed_steps_range CHECK (completed_steps >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX ux_ai_employee_autopilot_runs_active_version
      ON ai_employee_autopilot_runs (identity_version_id)
      WHERE status IN ('RUNNING', 'PAUSED')
    `);
    await queryRunner.query(
      `CREATE INDEX ix_ai_employee_autopilot_runs_version_created ON ai_employee_autopilot_runs (identity_version_id, created_at DESC)`
    );

    await queryRunner.query(`
      CREATE TABLE ai_employee_autopilot_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        autopilot_run_id uuid NOT NULL REFERENCES ai_employee_autopilot_runs(id) ON DELETE CASCADE,
        generation_job_id uuid REFERENCES generation_jobs(id) ON DELETE SET NULL,
        event_type varchar(40) NOT NULL,
        stage_key workflow_stage_key,
        action_code varchar(80),
        message text NOT NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ai_employee_autopilot_events_type_allowed CHECK (event_type IN ('STARTED', 'ACTION_STARTED', 'ACTION_SUCCEEDED', 'PAUSED', 'COMPLETED', 'FAILED')),
        CONSTRAINT ai_employee_autopilot_events_message_not_blank CHECK (length(btrim(message)) > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX ix_ai_employee_autopilot_events_run_created ON ai_employee_autopilot_events (autopilot_run_id, created_at DESC)`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_employee_autopilot_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_employee_autopilot_runs`);
  }
}
