import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBrandBookSchema1795131000000 implements MigrationInterface {
  name = 'CreateBrandBookSchema1795131000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE brand_book_status AS ENUM ('DRAFT', 'READY', 'FAILED', 'ARCHIVED')`);
    await queryRunner.query(`CREATE TYPE brand_book_export_format AS ENUM ('HTML', 'PDF', 'ZIP', 'MANIFEST_JSON')`);
    await queryRunner.query(`CREATE TYPE brand_book_export_status AS ENUM ('READY', 'FAILED', 'ARCHIVED')`);

    await queryRunner.query(`
      CREATE TABLE brand_books (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        identity_version_id uuid NOT NULL REFERENCES identity_versions(id) ON DELETE CASCADE,
        design_token_set_id uuid NOT NULL REFERENCES design_token_sets(id) ON DELETE RESTRICT,
        revision integer NOT NULL,
        status brand_book_status NOT NULL DEFAULT 'DRAFT',
        manifest_json jsonb NOT NULL,
        manifest_checksum_sha256 char(64) NOT NULL,
        html_preview text NOT NULL,
        error_message text,
        is_current boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT brand_books_revision_positive CHECK (revision > 0),
        CONSTRAINT brand_books_checksum_format CHECK (manifest_checksum_sha256 ~ '^[a-f0-9]{64}$')
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_brand_books_current_version ON brand_books (identity_version_id) WHERE is_current`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_brand_books_revision ON brand_books (identity_version_id, revision)`);

    await queryRunner.query(`
      CREATE TABLE brand_book_exports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        brand_book_id uuid NOT NULL REFERENCES brand_books(id) ON DELETE CASCADE,
        format brand_book_export_format NOT NULL,
        status brand_book_export_status NOT NULL DEFAULT 'READY',
        object_key text NOT NULL,
        mime_type varchar(120) NOT NULL,
        byte_size bigint NOT NULL,
        checksum_sha256 char(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT brand_book_exports_size_positive CHECK (byte_size > 0),
        CONSTRAINT brand_book_exports_checksum_format CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$')
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_brand_book_exports_book_format ON brand_book_exports (brand_book_id, format)`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_brand_book_exports_object_key ON brand_book_exports (object_key)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS brand_book_exports`);
    await queryRunner.query(`DROP TABLE IF EXISTS brand_books`);
    await queryRunner.query(`DROP TYPE IF EXISTS brand_book_export_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS brand_book_export_format`);
    await queryRunner.query(`DROP TYPE IF EXISTS brand_book_status`);
  }
}
