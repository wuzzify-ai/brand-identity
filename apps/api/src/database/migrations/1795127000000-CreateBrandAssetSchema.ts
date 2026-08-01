import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBrandAssetSchema1795127000000 implements MigrationInterface {
  name = 'CreateBrandAssetSchema1795127000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE brand_asset_category AS ENUM ('LOGO_CONCEPT', 'LOGO_FINAL', 'MOODBOARD', 'VISUAL_REFERENCE', 'BRAND_BOOK', 'EXPORT', 'OTHER')`
    );
    await queryRunner.query(`CREATE TYPE brand_asset_source AS ENUM ('USER_UPLOAD', 'AI_GENERATED', 'IMPORTED')`);
    await queryRunner.query(
      `CREATE TYPE brand_asset_status AS ENUM ('PENDING_UPLOAD', 'QUARANTINED', 'PROCESSING', 'AVAILABLE', 'REJECTED', 'ARCHIVED')`
    );
    await queryRunner.query(`CREATE TYPE brand_asset_visibility AS ENUM ('PRIVATE', 'PUBLIC_CDN')`);
    await queryRunner.query(`CREATE TYPE asset_variant_kind AS ENUM ('ORIGINAL', 'PREVIEW', 'THUMBNAIL')`);

    await queryRunner.query(`
      CREATE TABLE brand_assets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        identity_project_id uuid NOT NULL REFERENCES identity_projects(id) ON DELETE CASCADE,
        identity_version_id uuid NOT NULL REFERENCES identity_versions(id) ON DELETE CASCADE,
        visual_direction_id uuid REFERENCES visual_directions(id) ON DELETE SET NULL,
        uploaded_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        category brand_asset_category NOT NULL,
        source brand_asset_source NOT NULL DEFAULT 'USER_UPLOAD',
        status brand_asset_status NOT NULL DEFAULT 'PENDING_UPLOAD',
        visibility brand_asset_visibility NOT NULL DEFAULT 'PRIVATE',
        object_key text NOT NULL,
        original_filename varchar(255) NOT NULL,
        display_name varchar(180),
        alt_text text,
        declared_mime_type varchar(120) NOT NULL,
        detected_mime_type varchar(120),
        declared_byte_size bigint NOT NULL,
        actual_byte_size bigint,
        checksum_sha256 char(64),
        width integer,
        height integer,
        duration_ms integer,
        scan_status varchar(40) NOT NULL DEFAULT 'PENDING',
        rejection_reason text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        upload_expires_at timestamptz NOT NULL,
        uploaded_at timestamptz,
        processed_at timestamptz,
        available_at timestamptz,
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        lock_version integer NOT NULL DEFAULT 1,
        CONSTRAINT brand_assets_declared_size_positive CHECK (declared_byte_size > 0),
        CONSTRAINT brand_assets_actual_size_positive CHECK (actual_byte_size IS NULL OR actual_byte_size > 0),
        CONSTRAINT brand_assets_checksum_format CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$')
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_brand_assets_object_key ON brand_assets (object_key)`);
    await queryRunner.query(`CREATE INDEX ix_brand_assets_workspace_status ON brand_assets (workspace_id, status)`);
    await queryRunner.query(`CREATE INDEX ix_brand_assets_project_status ON brand_assets (identity_project_id, status)`);
    await queryRunner.query(`CREATE INDEX ix_brand_assets_version_status ON brand_assets (identity_version_id, status)`);
    await queryRunner.query(`CREATE INDEX ix_brand_assets_visual_direction ON brand_assets (visual_direction_id)`);
    await queryRunner.query(`CREATE INDEX ix_brand_assets_checksum ON brand_assets (workspace_id, checksum_sha256) WHERE checksum_sha256 IS NOT NULL`);

    await queryRunner.query(`
      CREATE TABLE asset_variants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        brand_asset_id uuid NOT NULL REFERENCES brand_assets(id) ON DELETE CASCADE,
        kind asset_variant_kind NOT NULL,
        object_key text NOT NULL,
        mime_type varchar(120) NOT NULL,
        byte_size bigint NOT NULL,
        checksum_sha256 char(64) NOT NULL,
        width integer,
        height integer,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT asset_variants_size_positive CHECK (byte_size > 0),
        CONSTRAINT asset_variants_checksum_format CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$')
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_asset_variants_object_key ON asset_variants (object_key)`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_asset_variants_asset_kind ON asset_variants (brand_asset_id, kind)`);
    await queryRunner.query(`CREATE INDEX ix_asset_variants_asset_kind ON asset_variants (brand_asset_id, kind)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS asset_variants`);
    await queryRunner.query(`DROP TABLE IF EXISTS brand_assets`);
    await queryRunner.query(`DROP TYPE IF EXISTS asset_variant_kind`);
    await queryRunner.query(`DROP TYPE IF EXISTS brand_asset_visibility`);
    await queryRunner.query(`DROP TYPE IF EXISTS brand_asset_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS brand_asset_source`);
    await queryRunner.query(`DROP TYPE IF EXISTS brand_asset_category`);
  }
}
