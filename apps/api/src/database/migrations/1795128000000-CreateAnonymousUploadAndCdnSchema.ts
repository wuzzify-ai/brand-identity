import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnonymousUploadAndCdnSchema1795128000000 implements MigrationInterface {
  name = 'CreateAnonymousUploadAndCdnSchema1795128000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE anonymous_upload_grant_status AS ENUM ('ISSUED', 'UPLOADED', 'COMPLETED', 'EXPIRED', 'REVOKED')`);

    await queryRunner.query(`
      ALTER TABLE brand_assets
      ADD COLUMN public_cdn_key text,
      ADD COLUMN public_cdn_url text,
      ADD COLUMN published_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN public_published_at timestamptz,
      ADD COLUMN public_unpublished_at timestamptz
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_brand_assets_public_cdn_key ON brand_assets (public_cdn_key) WHERE public_cdn_key IS NOT NULL`
    );
    await queryRunner.query(
      `CREATE INDEX ix_brand_assets_public_listing ON brand_assets (identity_project_id, visibility, status, public_published_at DESC)
       WHERE visibility = 'PUBLIC_CDN' AND status = 'AVAILABLE' AND public_unpublished_at IS NULL`
    );

    await queryRunner.query(`
      CREATE TABLE anonymous_upload_grants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        identity_project_id uuid NOT NULL REFERENCES identity_projects(id) ON DELETE CASCADE,
        identity_version_id uuid NOT NULL REFERENCES identity_versions(id) ON DELETE CASCADE,
        brand_asset_id uuid NOT NULL REFERENCES brand_assets(id) ON DELETE CASCADE,
        secret_hash char(64) NOT NULL,
        request_ip_hash char(64) NOT NULL,
        declared_byte_size bigint NOT NULL,
        used_at timestamptz,
        expires_at timestamptz NOT NULL,
        status anonymous_upload_grant_status NOT NULL DEFAULT 'ISSUED',
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT anonymous_upload_grants_size_positive CHECK (declared_byte_size > 0),
        CONSTRAINT anonymous_upload_grants_secret_hash_format CHECK (secret_hash ~ '^[a-f0-9]{64}$'),
        CONSTRAINT anonymous_upload_grants_ip_hash_format CHECK (request_ip_hash ~ '^[a-f0-9]{64}$')
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_anonymous_upload_grants_project_status ON anonymous_upload_grants (identity_project_id, status)`);
    await queryRunner.query(`CREATE INDEX ix_anonymous_upload_grants_asset ON anonymous_upload_grants (brand_asset_id)`);
    await queryRunner.query(`CREATE INDEX ix_anonymous_upload_grants_ip_created ON anonymous_upload_grants (request_ip_hash, created_at DESC)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS anonymous_upload_grants`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_brand_assets_public_listing`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_brand_assets_public_cdn_key`);
    await queryRunner.query(`
      ALTER TABLE brand_assets
      DROP COLUMN IF EXISTS public_unpublished_at,
      DROP COLUMN IF EXISTS public_published_at,
      DROP COLUMN IF EXISTS published_by_user_id,
      DROP COLUMN IF EXISTS public_cdn_url,
      DROP COLUMN IF EXISTS public_cdn_key
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS anonymous_upload_grant_status`);
  }
}
