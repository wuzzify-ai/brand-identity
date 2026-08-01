import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApprovalDecisionSchema1795132000000 implements MigrationInterface {
  name = 'CreateApprovalDecisionSchema1795132000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE approval_decision_type AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'ACTIVATED')`);
    await queryRunner.query(`
      CREATE TABLE approval_decisions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        identity_version_id uuid NOT NULL REFERENCES identity_versions(id) ON DELETE CASCADE,
        decided_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        decision approval_decision_type NOT NULL,
        from_status identity_version_status NOT NULL,
        to_status identity_version_status NOT NULL,
        reason text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_approval_decisions_version_created ON approval_decisions (identity_version_id, created_at DESC)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS approval_decisions`);
    await queryRunner.query(`DROP TYPE IF EXISTS approval_decision_type`);
  }
}
