import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditOutboxSchema1795133000000 implements MigrationInterface {
  name = 'CreateAuditOutboxSchema1795133000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
        identity_project_id uuid REFERENCES identity_projects(id) ON DELETE SET NULL,
        identity_version_id uuid REFERENCES identity_versions(id) ON DELETE SET NULL,
        actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        action varchar(120) NOT NULL,
        resource_type varchar(120) NOT NULL,
        resource_id uuid,
        before_json jsonb,
        after_json jsonb,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        request_id varchar(120),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_audit_logs_workspace_time ON audit_logs (workspace_id, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX ix_audit_logs_project_time ON audit_logs (identity_project_id, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX ix_audit_logs_version_time ON audit_logs (identity_version_id, created_at DESC)`);

    await queryRunner.query(`
      CREATE TABLE outbox_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        aggregate_type varchar(120) NOT NULL,
        aggregate_id uuid NOT NULL,
        event_type varchar(160) NOT NULL,
        schema_version integer NOT NULL DEFAULT 1,
        payload jsonb NOT NULL,
        idempotency_key varchar(240) NOT NULL,
        status varchar(40) NOT NULL DEFAULT 'PENDING',
        attempts integer NOT NULL DEFAULT 0,
        last_error text,
        available_at timestamptz NOT NULL DEFAULT now(),
        published_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT outbox_events_status_allowed CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
        CONSTRAINT outbox_events_attempts_non_negative CHECK (attempts >= 0)
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_outbox_events_idempotency_key ON outbox_events (idempotency_key)`);
    await queryRunner.query(`CREATE INDEX ix_outbox_events_unpublished ON outbox_events (status, available_at, created_at) WHERE status = 'PENDING'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS outbox_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
  }
}
