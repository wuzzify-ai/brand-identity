import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVisualDirectionSchema1795126000000 implements MigrationInterface {
  name = 'CreateVisualDirectionSchema1795126000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE visual_direction_status AS ENUM ('ACTIVE', 'ARCHIVED')`);
    await queryRunner.query(`CREATE TYPE visual_content_origin AS ENUM ('AI', 'USER', 'IMPORTED')`);

    await queryRunner.query(`
      CREATE TABLE visual_directions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        identity_version_id uuid NOT NULL REFERENCES identity_versions(id) ON DELETE CASCADE,
        name varchar(180) NOT NULL,
        rationale text,
        mood_keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
        imagery jsonb NOT NULL DEFAULT '[]'::jsonb,
        layout_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
        origin visual_content_origin NOT NULL DEFAULT 'USER',
        is_selected boolean NOT NULL DEFAULT false,
        status visual_direction_status NOT NULL DEFAULT 'ACTIVE',
        selected_at timestamptz,
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        lock_version integer NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_visual_directions_one_selected_version ON visual_directions (identity_version_id) WHERE is_selected AND status = 'ACTIVE'`
    );
    await queryRunner.query(`CREATE INDEX ix_visual_directions_version_status ON visual_directions (identity_version_id, status)`);

    await queryRunner.query(`
      CREATE TABLE visual_colors (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        visual_direction_id uuid NOT NULL REFERENCES visual_directions(id) ON DELETE CASCADE,
        token_name varchar(80) NOT NULL,
        name varchar(120) NOT NULL,
        hex char(7) NOT NULL,
        rgb jsonb NOT NULL,
        hsl jsonb NOT NULL,
        usage text,
        contrast_on_white numeric(5,2) NOT NULL,
        contrast_on_black numeric(5,2) NOT NULL,
        origin visual_content_origin NOT NULL DEFAULT 'USER',
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT visual_colors_hex_format CHECK (hex ~ '^#[0-9A-Fa-f]{6}$'),
        CONSTRAINT visual_colors_token_format CHECK (token_name ~ '^[a-z][a-z0-9-]*$'),
        CONSTRAINT visual_colors_token_unique UNIQUE (visual_direction_id, token_name)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_visual_colors_direction_order ON visual_colors (visual_direction_id, sort_order, id)`);

    await queryRunner.query(`
      CREATE TABLE visual_fonts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        visual_direction_id uuid NOT NULL REFERENCES visual_directions(id) ON DELETE CASCADE,
        role varchar(60) NOT NULL,
        family varchar(180) NOT NULL,
        fallback varchar(180) NOT NULL,
        weights integer[] NOT NULL DEFAULT '{400}',
        supported_scripts text[] NOT NULL DEFAULT '{}',
        source varchar(80) NOT NULL DEFAULT 'SYSTEM',
        license_status varchar(80) NOT NULL DEFAULT 'UNKNOWN',
        origin visual_content_origin NOT NULL DEFAULT 'USER',
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT visual_fonts_role_unique UNIQUE (visual_direction_id, role),
        CONSTRAINT visual_fonts_role_format CHECK (role ~ '^[a-z][a-z0-9-]*$'),
        CONSTRAINT visual_fonts_license_allowed CHECK (license_status IN ('UNKNOWN', 'OPEN', 'COMMERCIAL', 'RESTRICTED', 'CUSTOM')),
        CONSTRAINT visual_fonts_source_allowed CHECK (source IN ('SYSTEM', 'GOOGLE', 'ADOBE', 'CUSTOM', 'OTHER'))
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_visual_fonts_direction_order ON visual_fonts (visual_direction_id, sort_order, id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS visual_fonts`);
    await queryRunner.query(`DROP TABLE IF EXISTS visual_colors`);
    await queryRunner.query(`DROP TABLE IF EXISTS visual_directions`);
    await queryRunner.query(`DROP TYPE IF EXISTS visual_content_origin`);
    await queryRunner.query(`DROP TYPE IF EXISTS visual_direction_status`);
  }
}
