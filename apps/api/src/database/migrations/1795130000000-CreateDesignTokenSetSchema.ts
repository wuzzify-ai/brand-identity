import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDesignTokenSetSchema1795130000000 implements MigrationInterface {
  name = 'CreateDesignTokenSetSchema1795130000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE design_token_format AS ENUM ('JSON', 'CSS', 'SCSS', 'TAILWIND')`);
    await queryRunner.query(`
      CREATE TABLE design_token_sets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        identity_version_id uuid NOT NULL REFERENCES identity_versions(id) ON DELETE CASCADE,
        visual_direction_id uuid NOT NULL REFERENCES visual_directions(id) ON DELETE RESTRICT,
        selected_logo_concept_id uuid REFERENCES logo_concepts(id) ON DELETE SET NULL,
        format design_token_format NOT NULL,
        revision integer NOT NULL,
        is_current boolean NOT NULL DEFAULT true,
        checksum_sha256 char(64) NOT NULL,
        content_json jsonb,
        content_text text,
        source_fingerprint_sha256 char(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT design_token_sets_revision_positive CHECK (revision > 0),
        CONSTRAINT design_token_sets_checksum_format CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
        CONSTRAINT design_token_sets_fingerprint_format CHECK (source_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
        CONSTRAINT design_token_sets_content_by_format CHECK (
          (format = 'JSON' AND content_json IS NOT NULL AND content_text IS NULL)
          OR (format <> 'JSON' AND content_text IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_design_token_sets_current_format ON design_token_sets (identity_version_id, format) WHERE is_current`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_design_token_sets_revision_format ON design_token_sets (identity_version_id, format, revision)`
    );
    await queryRunner.query(`CREATE INDEX ix_design_token_sets_version_created ON design_token_sets (identity_version_id, created_at DESC)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS design_token_sets`);
    await queryRunner.query(`DROP TYPE IF EXISTS design_token_format`);
  }
}
