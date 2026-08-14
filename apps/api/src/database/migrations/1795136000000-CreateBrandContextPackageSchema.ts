import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBrandContextPackageSchema1795136000000 implements MigrationInterface {
  name = 'CreateBrandContextPackageSchema1795136000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE brand_context_package_status AS ENUM ('PUBLISHED', 'REVOKED', 'ARCHIVED')`);
    await queryRunner.query(`CREATE TYPE brand_context_package_source AS ENUM ('GENERATED', 'IMPORTED', 'HYBRID')`);

    await queryRunner.query(`
      CREATE TABLE brand_context_packages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        identity_project_id uuid NOT NULL REFERENCES identity_projects(id) ON DELETE CASCADE,
        identity_version_id uuid NOT NULL REFERENCES identity_versions(id) ON DELETE CASCADE,
        source brand_context_package_source NOT NULL DEFAULT 'GENERATED',
        status brand_context_package_status NOT NULL DEFAULT 'PUBLISHED',
        revision integer NOT NULL,
        package_json jsonb NOT NULL,
        checksum_sha256 char(64) NOT NULL,
        published_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        published_at timestamptz NOT NULL DEFAULT now(),
        revoked_at timestamptz,
        revocation_reason text,
        is_current boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT brand_context_packages_revision_positive CHECK (revision > 0),
        CONSTRAINT brand_context_packages_checksum_format CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
        CONSTRAINT brand_context_packages_revoked_reason CHECK (
          status <> 'REVOKED' OR (revoked_at IS NOT NULL AND length(btrim(COALESCE(revocation_reason, ''))) > 0)
        )
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_brand_context_packages_current_project ON brand_context_packages (identity_project_id) WHERE is_current AND status = 'PUBLISHED'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_brand_context_packages_version_revision ON brand_context_packages (identity_version_id, revision)`
    );
    await queryRunner.query(
      `CREATE INDEX ix_brand_context_packages_workspace_project ON brand_context_packages (workspace_id, identity_project_id, published_at DESC)`
    );
    await queryRunner.query(
      `CREATE INDEX ix_brand_context_packages_version_status ON brand_context_packages (identity_version_id, status, published_at DESC)`
    );

    await queryRunner.query(`ALTER TABLE identity_projects ADD COLUMN active_context_package_id uuid`);
    await queryRunner.query(
      `ALTER TABLE identity_projects ADD CONSTRAINT fk_identity_projects_active_context_package
       FOREIGN KEY (active_context_package_id) REFERENCES brand_context_packages(id) ON DELETE SET NULL`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE identity_projects DROP CONSTRAINT IF EXISTS fk_identity_projects_active_context_package`);
    await queryRunner.query(`ALTER TABLE identity_projects DROP COLUMN IF EXISTS active_context_package_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS brand_context_packages`);
    await queryRunner.query(`DROP TYPE IF EXISTS brand_context_package_source`);
    await queryRunner.query(`DROP TYPE IF EXISTS brand_context_package_status`);
  }
}
