import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBrandStrategySchema1795125000000 implements MigrationInterface {
  name = 'CreateBrandStrategySchema1795125000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE strategy_content_origin AS ENUM ('AI', 'USER', 'IMPORTED')`);

    await queryRunner.query(`
      CREATE TABLE brand_strategies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        identity_version_id uuid NOT NULL UNIQUE REFERENCES identity_versions(id) ON DELETE CASCADE,
        positioning text,
        value_proposition text,
        mission text,
        vision text,
        essence text,
        promise text,
        origin strategy_content_origin NOT NULL DEFAULT 'USER',
        completion_percent smallint NOT NULL DEFAULT 0,
        completion_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
        confirmed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        confirmed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        lock_version integer NOT NULL DEFAULT 1,
        CONSTRAINT brand_strategies_completion_range CHECK (completion_percent BETWEEN 0 AND 100)
      )
    `);

    await this.createChildTable(queryRunner, 'brand_strategy_values', `text text NOT NULL`);
    await this.createChildTable(queryRunner, 'brand_strategy_rules', `text text NOT NULL, legal_review_required boolean NOT NULL DEFAULT false`);
    await this.createChildTable(queryRunner, 'brand_strategy_taglines', `
      text text NOT NULL,
      language_code varchar(20) NOT NULL DEFAULT 'en',
      is_selected boolean NOT NULL DEFAULT false,
      legal_review_required boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_brand_strategy_taglines_selected_language ON brand_strategy_taglines (brand_strategy_id, language_code) WHERE is_selected`
    );

    await this.createChildTable(queryRunner, 'brand_strategy_personas', `
      name varchar(180) NOT NULL,
      segment text,
      needs jsonb NOT NULL DEFAULT '[]'::jsonb,
      pains jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
    await this.createChildTable(queryRunner, 'brand_strategy_messaging_pillars', `
      title varchar(180) NOT NULL,
      message text NOT NULL,
      proof_points jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS brand_strategy_messaging_pillars`);
    await queryRunner.query(`DROP TABLE IF EXISTS brand_strategy_personas`);
    await queryRunner.query(`DROP TABLE IF EXISTS brand_strategy_taglines`);
    await queryRunner.query(`DROP TABLE IF EXISTS brand_strategy_rules`);
    await queryRunner.query(`DROP TABLE IF EXISTS brand_strategy_values`);
    await queryRunner.query(`DROP TABLE IF EXISTS brand_strategies`);
    await queryRunner.query(`DROP TYPE IF EXISTS strategy_content_origin`);
  }

  private async createChildTable(queryRunner: QueryRunner, tableName: string, columnsSql: string): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ${tableName} (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        brand_strategy_id uuid NOT NULL REFERENCES brand_strategies(id) ON DELETE CASCADE,
        ${columnsSql},
        origin strategy_content_origin NOT NULL DEFAULT 'USER',
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_${tableName}_strategy_order ON ${tableName} (brand_strategy_id, sort_order, id)`);
  }
}
