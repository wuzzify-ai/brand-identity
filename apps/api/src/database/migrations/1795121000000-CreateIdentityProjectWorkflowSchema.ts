import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIdentityProjectWorkflowSchema1795121000000 implements MigrationInterface {
  name = 'CreateIdentityProjectWorkflowSchema1795121000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE identity_project_status AS ENUM ('ACTIVE', 'ARCHIVED')`);
    await queryRunner.query(`
      CREATE TYPE identity_version_status AS ENUM (
        'DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED'
      )
    `);
    await queryRunner.query(`CREATE TYPE workflow_stage_key AS ENUM ('BRIEF', 'STRATEGY', 'VISUALS', 'ASSETS', 'FINALIZE')`);
    await queryRunner.query(`
      CREATE TYPE workflow_stage_status AS ENUM (
        'LOCKED', 'NOT_STARTED', 'GENERATING', 'NEEDS_INPUT', 'READY', 'COMPLETED', 'STALE', 'FAILED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE identity_projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        parent_project_id uuid,
        created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        name varchar(180) NOT NULL,
        slug varchar(200),
        status identity_project_status NOT NULL DEFAULT 'ACTIVE',
        public_asset_slug varchar(200),
        anonymous_uploads_enabled boolean NOT NULL DEFAULT false,
        anonymous_upload_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
        active_version_id uuid,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        archived_at timestamptz,
        lock_version integer NOT NULL DEFAULT 1,
        CONSTRAINT identity_projects_name_not_blank CHECK (length(btrim(name)) > 0),
        CONSTRAINT identity_projects_lock_version_positive CHECK (lock_version > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_identity_projects_workspace_slug ON identity_projects (workspace_id, slug) WHERE slug IS NOT NULL AND status = 'ACTIVE'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_identity_projects_public_asset_slug ON identity_projects (public_asset_slug) WHERE public_asset_slug IS NOT NULL AND status = 'ACTIVE'`
    );
    await queryRunner.query(`CREATE INDEX ix_identity_projects_workspace_parent ON identity_projects (workspace_id, parent_project_id)`);
    await queryRunner.query(`CREATE INDEX ix_identity_projects_workspace_updated ON identity_projects (workspace_id, updated_at DESC)`);

    await queryRunner.query(`
      CREATE TABLE identity_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        identity_project_id uuid NOT NULL REFERENCES identity_projects(id) ON DELETE CASCADE,
        version_number integer NOT NULL,
        status identity_version_status NOT NULL DEFAULT 'DRAFT',
        source_version_id uuid REFERENCES identity_versions(id) ON DELETE SET NULL,
        created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        submitted_at timestamptz,
        approved_at timestamptz,
        activated_at timestamptz,
        superseded_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        lock_version integer NOT NULL DEFAULT 1,
        CONSTRAINT identity_versions_number_positive CHECK (version_number > 0),
        CONSTRAINT identity_versions_project_number_unique UNIQUE (identity_project_id, version_number)
      )
    `);
    await queryRunner.query(
      `ALTER TABLE identity_projects ADD CONSTRAINT fk_identity_projects_active_version FOREIGN KEY (active_version_id) REFERENCES identity_versions(id) ON DELETE SET NULL`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_identity_versions_one_active_per_project ON identity_versions (identity_project_id) WHERE status = 'ACTIVE'`
    );
    await queryRunner.query(`CREATE INDEX ix_identity_versions_project_status ON identity_versions (identity_project_id, status)`);

    await queryRunner.query(`
      CREATE TABLE workflow_stages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        identity_version_id uuid NOT NULL REFERENCES identity_versions(id) ON DELETE CASCADE,
        stage_key workflow_stage_key NOT NULL,
        status workflow_stage_status NOT NULL DEFAULT 'LOCKED',
        completion_percent smallint NOT NULL DEFAULT 0,
        confirmed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        confirmed_at timestamptz,
        stale_reason text,
        last_generation_job_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT workflow_stage_percent_range CHECK (completion_percent BETWEEN 0 AND 100),
        CONSTRAINT workflow_stage_version_key_unique UNIQUE (identity_version_id, stage_key)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS workflow_stages`);
    await queryRunner.query(`ALTER TABLE identity_projects DROP CONSTRAINT IF EXISTS fk_identity_projects_active_version`);
    await queryRunner.query(`DROP TABLE IF EXISTS identity_versions`);
    await queryRunner.query(`DROP TABLE IF EXISTS identity_projects`);
    await queryRunner.query(`DROP TYPE IF EXISTS workflow_stage_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS workflow_stage_key`);
    await queryRunner.query(`DROP TYPE IF EXISTS identity_version_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS identity_project_status`);
  }
}
