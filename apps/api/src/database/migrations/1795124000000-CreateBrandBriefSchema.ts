import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBrandBriefSchema1795124000000 implements MigrationInterface {
  name = 'CreateBrandBriefSchema1795124000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE brief_content_origin AS ENUM ('AI', 'USER', 'IMPORTED')`);

    await queryRunner.query(`
      CREATE TABLE brand_briefs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        identity_version_id uuid NOT NULL UNIQUE REFERENCES identity_versions(id) ON DELETE CASCADE,
        industry text,
        positioning text,
        origin brief_content_origin NOT NULL DEFAULT 'USER',
        completion_percent smallint NOT NULL DEFAULT 0,
        completion_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
        confirmed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        confirmed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        lock_version integer NOT NULL DEFAULT 1,
        CONSTRAINT brand_briefs_completion_range CHECK (completion_percent BETWEEN 0 AND 100)
      )
    `);

    await this.createChildTable(queryRunner, 'brand_brief_languages', `
      language_code varchar(20) NOT NULL,
      display_name varchar(120) NOT NULL,
      is_primary boolean NOT NULL DEFAULT false,
      CONSTRAINT brand_brief_languages_code_unique UNIQUE (brand_brief_id, language_code)
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_brand_brief_languages_one_primary ON brand_brief_languages (brand_brief_id) WHERE is_primary`
    );

    await this.createChildTable(queryRunner, 'brand_brief_audiences', `name varchar(180) NOT NULL, description text`);
    await this.createChildTable(queryRunner, 'brand_brief_markets', `name varchar(180) NOT NULL, region text`);
    await this.createChildTable(queryRunner, 'brand_brief_offerings', `name varchar(180) NOT NULL, description text`);
    await this.createChildTable(queryRunner, 'brand_brief_preferences', `text text NOT NULL`);
    await this.createChildTable(queryRunner, 'brand_brief_constraints', `text text NOT NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS brand_brief_constraints`);
    await queryRunner.query(`DROP TABLE IF EXISTS brand_brief_preferences`);
    await queryRunner.query(`DROP TABLE IF EXISTS brand_brief_offerings`);
    await queryRunner.query(`DROP TABLE IF EXISTS brand_brief_markets`);
    await queryRunner.query(`DROP TABLE IF EXISTS brand_brief_audiences`);
    await queryRunner.query(`DROP TABLE IF EXISTS brand_brief_languages`);
    await queryRunner.query(`DROP TABLE IF EXISTS brand_briefs`);
    await queryRunner.query(`DROP TYPE IF EXISTS brief_content_origin`);
  }

  private async createChildTable(queryRunner: QueryRunner, tableName: string, columnsSql: string): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ${tableName} (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        brand_brief_id uuid NOT NULL REFERENCES brand_briefs(id) ON DELETE CASCADE,
        ${columnsSql},
        origin brief_content_origin NOT NULL DEFAULT 'USER',
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_${tableName}_brief_order ON ${tableName} (brand_brief_id, sort_order, id)`);
  }
}
