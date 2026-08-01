import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLogoConceptSchema1795129000000 implements MigrationInterface {
  name = 'CreateLogoConceptSchema1795129000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE logo_concept_type AS ENUM ('WORDMARK', 'LETTERMARK', 'SYMBOL', 'COMBINATION', 'EMBLEM')`);
    await queryRunner.query(`CREATE TYPE logo_concept_status AS ENUM ('DRAFT', 'SHORTLISTED', 'SELECTED', 'REJECTED', 'ARCHIVED')`);
    await queryRunner.query(`CREATE TYPE logo_concept_review_status AS ENUM ('REVIEW_REQUIRED', 'REVIEWED', 'PRODUCTION_READY')`);

    await queryRunner.query(`
      CREATE TABLE logo_concepts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        identity_version_id uuid NOT NULL REFERENCES identity_versions(id) ON DELETE CASCADE,
        visual_direction_id uuid NOT NULL REFERENCES visual_directions(id) ON DELETE RESTRICT,
        generation_job_id uuid REFERENCES generation_jobs(id) ON DELETE SET NULL,
        type logo_concept_type NOT NULL,
        status logo_concept_status NOT NULL DEFAULT 'DRAFT',
        review_status logo_concept_review_status NOT NULL DEFAULT 'REVIEW_REQUIRED',
        name varchar(180) NOT NULL,
        rationale text NOT NULL,
        language_codes text[] NOT NULL DEFAULT '{}',
        prompt text NOT NULL,
        production_notes text,
        review_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        selected_at timestamptz,
        reviewed_at timestamptz,
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        lock_version integer NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_logo_concepts_one_selected_version ON logo_concepts (identity_version_id) WHERE status = 'SELECTED'`
    );
    await queryRunner.query(`CREATE INDEX ix_logo_concepts_version_status ON logo_concepts (identity_version_id, status)`);
    await queryRunner.query(`CREATE INDEX ix_logo_concepts_visual_direction ON logo_concepts (visual_direction_id)`);

    await queryRunner.query(`
      CREATE TABLE logo_concept_assets (
        logo_concept_id uuid NOT NULL REFERENCES logo_concepts(id) ON DELETE CASCADE,
        brand_asset_id uuid NOT NULL REFERENCES brand_assets(id) ON DELETE CASCADE,
        role varchar(80) NOT NULL DEFAULT 'preview',
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (logo_concept_id, brand_asset_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_logo_concept_assets_concept_order ON logo_concept_assets (logo_concept_id, sort_order)`);
    await queryRunner.query(`CREATE INDEX ix_logo_concept_assets_asset ON logo_concept_assets (brand_asset_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS logo_concept_assets`);
    await queryRunner.query(`DROP TABLE IF EXISTS logo_concepts`);
    await queryRunner.query(`DROP TYPE IF EXISTS logo_concept_review_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS logo_concept_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS logo_concept_type`);
  }
}
