import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiEmployeeHandoffSchema1795139000000 implements MigrationInterface {
  name = 'CreateAiEmployeeHandoffSchema1795139000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ai_employee_handoffs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        identity_version_id uuid NOT NULL REFERENCES identity_versions(id) ON DELETE CASCADE,
        generation_job_id uuid REFERENCES generation_jobs(id) ON DELETE SET NULL,
        from_stage_key workflow_stage_key NOT NULL,
        to_stage_key workflow_stage_key,
        task generation_task NOT NULL,
        employee_role varchar(120) NOT NULL,
        summary text NOT NULL,
        notes jsonb NOT NULL DEFAULT '[]'::jsonb,
        recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
        is_current boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ai_employee_handoffs_summary_not_blank CHECK (length(btrim(summary)) > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX ix_ai_employee_handoffs_version_created ON ai_employee_handoffs (identity_version_id, created_at DESC)`
    );
    await queryRunner.query(
      `CREATE INDEX ix_ai_employee_handoffs_version_stage_current ON ai_employee_handoffs (identity_version_id, from_stage_key, is_current)`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_employee_handoffs`);
  }
}
