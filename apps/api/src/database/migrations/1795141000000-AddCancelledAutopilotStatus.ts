import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCancelledAutopilotStatus1795141000000 implements MigrationInterface {
  name = 'AddCancelledAutopilotStatus1795141000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ai_employee_autopilot_runs
      DROP CONSTRAINT IF EXISTS ai_employee_autopilot_runs_status_allowed
    `);
    await queryRunner.query(`
      ALTER TABLE ai_employee_autopilot_runs
      ADD CONSTRAINT ai_employee_autopilot_runs_status_allowed
      CHECK (status IN ('RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'))
    `);
    await queryRunner.query(`
      ALTER TABLE ai_employee_autopilot_events
      DROP CONSTRAINT IF EXISTS ai_employee_autopilot_events_type_allowed
    `);
    await queryRunner.query(`
      ALTER TABLE ai_employee_autopilot_events
      ADD CONSTRAINT ai_employee_autopilot_events_type_allowed
      CHECK (event_type IN ('STARTED', 'ACTION_STARTED', 'ACTION_SUCCEEDED', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ai_employee_autopilot_events
      DROP CONSTRAINT IF EXISTS ai_employee_autopilot_events_type_allowed
    `);
    await queryRunner.query(`
      ALTER TABLE ai_employee_autopilot_events
      ADD CONSTRAINT ai_employee_autopilot_events_type_allowed
      CHECK (event_type IN ('STARTED', 'ACTION_STARTED', 'ACTION_SUCCEEDED', 'PAUSED', 'COMPLETED', 'FAILED'))
    `);
    await queryRunner.query(`
      ALTER TABLE ai_employee_autopilot_runs
      DROP CONSTRAINT IF EXISTS ai_employee_autopilot_runs_status_allowed
    `);
    await queryRunner.query(`
      ALTER TABLE ai_employee_autopilot_runs
      ADD CONSTRAINT ai_employee_autopilot_runs_status_allowed
      CHECK (status IN ('RUNNING', 'PAUSED', 'COMPLETED', 'FAILED'))
    `);
  }
}
