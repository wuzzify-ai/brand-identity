import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBrandContextPinsToGenerationSchema1795137000000 implements MigrationInterface {
  name = 'AddBrandContextPinsToGenerationSchema1795137000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE generation_jobs
      ADD COLUMN brand_context_package_id uuid REFERENCES brand_context_packages(id) ON DELETE SET NULL,
      ADD COLUMN brand_context_package_checksum_sha256 char(64),
      ADD CONSTRAINT generation_jobs_brand_context_pin_complete CHECK (
        (brand_context_package_id IS NULL AND brand_context_package_checksum_sha256 IS NULL)
        OR (brand_context_package_id IS NOT NULL AND brand_context_package_checksum_sha256 IS NOT NULL)
      ),
      ADD CONSTRAINT generation_jobs_brand_context_checksum_format CHECK (
        brand_context_package_checksum_sha256 IS NULL OR brand_context_package_checksum_sha256 ~ '^[a-f0-9]{64}$'
      )
    `);
    await queryRunner.query(
      `CREATE INDEX ix_generation_jobs_brand_context_package ON generation_jobs (brand_context_package_id)
       WHERE brand_context_package_id IS NOT NULL`
    );

    await queryRunner.query(`
      ALTER TABLE ai_generation_runs
      ADD COLUMN brand_context_package_id uuid REFERENCES brand_context_packages(id) ON DELETE SET NULL,
      ADD COLUMN brand_context_package_checksum_sha256 char(64),
      ADD CONSTRAINT ai_generation_runs_brand_context_pin_complete CHECK (
        (brand_context_package_id IS NULL AND brand_context_package_checksum_sha256 IS NULL)
        OR (brand_context_package_id IS NOT NULL AND brand_context_package_checksum_sha256 IS NOT NULL)
      ),
      ADD CONSTRAINT ai_generation_runs_brand_context_checksum_format CHECK (
        brand_context_package_checksum_sha256 IS NULL OR brand_context_package_checksum_sha256 ~ '^[a-f0-9]{64}$'
      )
    `);
    await queryRunner.query(
      `CREATE INDEX ix_ai_generation_runs_brand_context_package ON ai_generation_runs (brand_context_package_id)
       WHERE brand_context_package_id IS NOT NULL`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ix_ai_generation_runs_brand_context_package`);
    await queryRunner.query(`
      ALTER TABLE ai_generation_runs
      DROP CONSTRAINT IF EXISTS ai_generation_runs_brand_context_checksum_format,
      DROP CONSTRAINT IF EXISTS ai_generation_runs_brand_context_pin_complete,
      DROP COLUMN IF EXISTS brand_context_package_checksum_sha256,
      DROP COLUMN IF EXISTS brand_context_package_id
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_generation_jobs_brand_context_package`);
    await queryRunner.query(`
      ALTER TABLE generation_jobs
      DROP CONSTRAINT IF EXISTS generation_jobs_brand_context_checksum_format,
      DROP CONSTRAINT IF EXISTS generation_jobs_brand_context_pin_complete,
      DROP COLUMN IF EXISTS brand_context_package_checksum_sha256,
      DROP COLUMN IF EXISTS brand_context_package_id
    `);
  }
}
