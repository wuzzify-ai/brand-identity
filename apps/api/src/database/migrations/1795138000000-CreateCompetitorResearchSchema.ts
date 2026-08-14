import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompetitorResearchSchema1795138000000 implements MigrationInterface {
  name = 'CreateCompetitorResearchSchema1795138000000';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE generation_task ADD VALUE IF NOT EXISTS 'COMPETITOR_RESEARCH'`);

    await queryRunner.query(`CREATE TYPE competitor_research_status AS ENUM ('READY', 'FAILED', 'ARCHIVED')`);

    await queryRunner.query(`
      CREATE TABLE competitor_researches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        identity_version_id uuid NOT NULL REFERENCES identity_versions(id) ON DELETE CASCADE,
        generation_job_id uuid REFERENCES generation_jobs(id) ON DELETE SET NULL,
        revision integer NOT NULL,
        status competitor_research_status NOT NULL DEFAULT 'READY',
        summary text NOT NULL,
        search_queries jsonb NOT NULL DEFAULT '[]'::jsonb,
        limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        is_current boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT competitor_researches_revision_positive CHECK (revision > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_competitor_researches_current_version ON competitor_researches (identity_version_id) WHERE is_current`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_competitor_researches_version_revision ON competitor_researches (identity_version_id, revision)`
    );

    await queryRunner.query(`
      CREATE TABLE brand_competitors (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        competitor_research_id uuid NOT NULL REFERENCES competitor_researches(id) ON DELETE CASCADE,
        name varchar(180) NOT NULL,
        website_url text,
        category varchar(120),
        positioning text,
        summary text NOT NULL,
        strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
        weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
        differentiators jsonb NOT NULL DEFAULT '[]'::jsonb,
        evidence_summary text,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT brand_competitors_name_not_blank CHECK (length(btrim(name)) > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX ix_brand_competitors_research_order ON brand_competitors (competitor_research_id, sort_order, id)`
    );

    await queryRunner.query(`
      CREATE TABLE brand_competitor_citations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        brand_competitor_id uuid NOT NULL REFERENCES brand_competitors(id) ON DELETE CASCADE,
        title text NOT NULL,
        url text NOT NULL,
        publisher varchar(180),
        snippet text,
        retrieved_at timestamptz NOT NULL DEFAULT now(),
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT brand_competitor_citations_url_not_blank CHECK (length(btrim(url)) > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX ix_brand_competitor_citations_competitor_order ON brand_competitor_citations (brand_competitor_id, sort_order, id)`
    );

    await queryRunner.query(`
      INSERT INTO ai_prompt_templates (task, version, name, system_template, user_template, input_schema, output_schema, checksum_sha256, is_active)
      VALUES (
        'COMPETITOR_RESEARCH',
        1,
        'Competitor research v1',
        'Research likely direct and adjacent competitors for the confirmed brand brief. Use web search. Return strict JSON with citations. Do not invent facts.',
        '{{brief_json}}',
        '{}'::jsonb,
        '{}'::jsonb,
        repeat('0', 64),
        true
      )
      ON CONFLICT (task, version) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO ai_model_policies (task, tier, modality, primary_model, fallback_models, provider_preferences, request_parameters)
      VALUES
        ('COMPETITOR_RESEARCH', 'FAST', 'TEXT', 'openai/gpt-5.6-luna', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"nitro","require_parameters":true}'::jsonb, '{"temperature":0.1}'::jsonb),
        ('COMPETITOR_RESEARCH', 'BALANCED', 'TEXT', 'openai/gpt-5.6-terra', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"balanced","require_parameters":true}'::jsonb, '{"temperature":0.1}'::jsonb),
        ('COMPETITOR_RESEARCH', 'PREMIUM', 'TEXT', 'openai/gpt-5.6-sol', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"exacto","require_parameters":true}'::jsonb, '{"temperature":0.05}'::jsonb)
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM ai_model_policies WHERE task = 'COMPETITOR_RESEARCH'`);
    await queryRunner.query(`DELETE FROM ai_prompt_templates WHERE task = 'COMPETITOR_RESEARCH'`);
    await queryRunner.query(`DROP TABLE IF EXISTS brand_competitor_citations`);
    await queryRunner.query(`DROP TABLE IF EXISTS brand_competitors`);
    await queryRunner.query(`DROP TABLE IF EXISTS competitor_researches`);
    await queryRunner.query(`DROP TYPE IF EXISTS competitor_research_status`);
  }
}
