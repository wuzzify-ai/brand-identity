import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiPolicySchema1795122000000 implements MigrationInterface {
  name = 'CreateAiPolicySchema1795122000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE generation_task AS ENUM (
        'BRIEF_EXTRACT', 'BRIEF_IMPROVE', 'STRATEGY_GENERATE', 'STRATEGY_SECTION_REGENERATE',
        'VISUAL_DIRECTIONS_GENERATE', 'VISUAL_VARIATION_GENERATE', 'LOGO_CONCEPTS_GENERATE',
        'BRAND_BOOK_NARRATIVE_GENERATE', 'QUALITY_REVIEW'
      )
    `);
    await queryRunner.query(`CREATE TYPE ai_modality AS ENUM ('TEXT', 'IMAGE')`);

    await queryRunner.query(`
      CREATE TABLE ai_prompt_templates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        task generation_task NOT NULL,
        version integer NOT NULL,
        name varchar(180) NOT NULL,
        system_template text NOT NULL,
        user_template text NOT NULL,
        input_schema jsonb NOT NULL,
        output_schema jsonb NOT NULL,
        checksum_sha256 char(64) NOT NULL,
        is_active boolean NOT NULL DEFAULT false,
        created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        retired_at timestamptz,
        CONSTRAINT ai_prompt_templates_version_positive CHECK (version > 0),
        CONSTRAINT ai_prompt_templates_task_version_unique UNIQUE (task, version)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_ai_prompt_templates_one_active_task ON ai_prompt_templates (task) WHERE is_active`
    );

    await queryRunner.query(`
      CREATE TABLE ai_model_policies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        task generation_task NOT NULL,
        tier varchar(30) NOT NULL,
        modality ai_modality NOT NULL,
        primary_model varchar(180) NOT NULL,
        fallback_models text[] NOT NULL DEFAULT '{}',
        provider_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
        request_parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
        max_attempts smallint NOT NULL DEFAULT 2,
        timeout_ms integer NOT NULL DEFAULT 120000,
        is_active boolean NOT NULL DEFAULT true,
        effective_from timestamptz NOT NULL DEFAULT now(),
        effective_to timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ai_model_policies_tier_allowed CHECK (tier IN ('FAST', 'BALANCED', 'PREMIUM')),
        CONSTRAINT ai_model_policies_attempts_range CHECK (max_attempts BETWEEN 1 AND 5),
        CONSTRAINT ai_model_policies_timeout_positive CHECK (timeout_ms > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_ai_model_policies_active_task_tier ON ai_model_policies (task, tier) WHERE is_active AND effective_to IS NULL`
    );

    await queryRunner.query(`
      INSERT INTO ai_prompt_templates (task, version, name, system_template, user_template, input_schema, output_schema, checksum_sha256, is_active)
      VALUES
        ('BRIEF_EXTRACT', 1, 'Brief extraction v1', 'Extract a brand brief as strict JSON.', '{{business_description}}', '{}'::jsonb, '{}'::jsonb, repeat('0', 64), true),
        ('BRIEF_IMPROVE', 1, 'Brief improvement v1', 'Improve the brand brief while preserving user intent. Return strict JSON.', '{{current_brief_json}}\n\nInstructions: {{user_instructions}}', '{}'::jsonb, '{}'::jsonb, repeat('0', 64), true),
        ('STRATEGY_GENERATE', 1, 'Strategy generation v1', 'Generate brand strategy as strict JSON.', '{{brief_json}}', '{}'::jsonb, '{}'::jsonb, repeat('0', 64), true),
        ('STRATEGY_SECTION_REGENERATE', 1, 'Strategy section regeneration v1', 'Regenerate one strategy section and return the full strict JSON strategy object.', '{{brief_json}}\n\n{{strategy_json}}\n\nSection: {{section}}\nInstructions: {{user_instructions}}', '{}'::jsonb, '{}'::jsonb, repeat('0', 64), true),
        ('VISUAL_DIRECTIONS_GENERATE', 1, 'Visual directions v1', 'Generate visual directions, color systems, and font systems as strict JSON.', '{{brief_json}}\n\n{{strategy_json}}', '{}'::jsonb, '{}'::jsonb, repeat('0', 64), true),
        ('VISUAL_VARIATION_GENERATE', 1, 'Visual variation v1', 'Create one edited visual direction as strict JSON.', '{{visual_direction_json}}\n\nInstructions: {{user_instructions}}', '{}'::jsonb, '{}'::jsonb, repeat('0', 64), true),
        ('LOGO_CONCEPTS_GENERATE', 1, 'Logo concepts v1', 'Generate logo concept prompts and asset metadata.', '{{brief_json}}\n\n{{strategy_json}}\n\n{{visual_direction_json}}', '{}'::jsonb, '{}'::jsonb, repeat('0', 64), true),
        ('BRAND_BOOK_NARRATIVE_GENERATE', 1, 'Brand book narrative v1', 'Write concise brand book chapters as strict JSON.', '{{identity_version_json}}', '{}'::jsonb, '{}'::jsonb, repeat('0', 64), true),
        ('QUALITY_REVIEW', 1, 'Quality review v1', 'Review the identity version for consistency, completeness, and brand safety. Return strict JSON.', '{{identity_version_json}}', '{}'::jsonb, '{}'::jsonb, repeat('0', 64), true)
    `);

    await queryRunner.query(`
      INSERT INTO ai_model_policies (task, tier, modality, primary_model, fallback_models, provider_preferences, request_parameters)
      VALUES
        ('BRIEF_EXTRACT', 'FAST', 'TEXT', 'openai/gpt-5.6-luna', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"nitro","require_parameters":true}'::jsonb, '{"temperature":0.15}'::jsonb),
        ('BRIEF_EXTRACT', 'BALANCED', 'TEXT', 'openai/gpt-5.6-terra', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"balanced","require_parameters":true}'::jsonb, '{"temperature":0.2}'::jsonb),
        ('BRIEF_EXTRACT', 'PREMIUM', 'TEXT', 'openai/gpt-5.6-sol', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"exacto","require_parameters":true}'::jsonb, '{"temperature":0.2}'::jsonb),
        ('BRIEF_IMPROVE', 'FAST', 'TEXT', 'openai/gpt-5.6-luna', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"nitro","require_parameters":true}'::jsonb, '{"temperature":0.2}'::jsonb),
        ('BRIEF_IMPROVE', 'BALANCED', 'TEXT', 'openai/gpt-5.6-terra', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"balanced","require_parameters":true}'::jsonb, '{"temperature":0.25}'::jsonb),
        ('BRIEF_IMPROVE', 'PREMIUM', 'TEXT', 'openai/gpt-5.6-sol', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"exacto","require_parameters":true}'::jsonb, '{"temperature":0.25}'::jsonb),
        ('STRATEGY_GENERATE', 'FAST', 'TEXT', 'openai/gpt-5.6-luna', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"nitro","require_parameters":true}'::jsonb, '{"temperature":0.3}'::jsonb),
        ('STRATEGY_GENERATE', 'BALANCED', 'TEXT', 'openai/gpt-5.6-terra', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"balanced","require_parameters":true}'::jsonb, '{"temperature":0.35}'::jsonb),
        ('STRATEGY_GENERATE', 'PREMIUM', 'TEXT', 'openai/gpt-5.6-sol', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"exacto","require_parameters":true}'::jsonb, '{"temperature":0.35}'::jsonb),
        ('STRATEGY_SECTION_REGENERATE', 'FAST', 'TEXT', 'openai/gpt-5.6-luna', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"nitro","require_parameters":true}'::jsonb, '{"temperature":0.25}'::jsonb),
        ('STRATEGY_SECTION_REGENERATE', 'BALANCED', 'TEXT', 'openai/gpt-5.6-terra', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"balanced","require_parameters":true}'::jsonb, '{"temperature":0.3}'::jsonb),
        ('STRATEGY_SECTION_REGENERATE', 'PREMIUM', 'TEXT', 'openai/gpt-5.6-sol', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"exacto","require_parameters":true}'::jsonb, '{"temperature":0.3}'::jsonb),
        ('VISUAL_DIRECTIONS_GENERATE', 'FAST', 'TEXT', 'openai/gpt-5.6-luna', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"nitro","require_parameters":true}'::jsonb, '{"temperature":0.4}'::jsonb),
        ('VISUAL_DIRECTIONS_GENERATE', 'BALANCED', 'TEXT', 'openai/gpt-5.6-terra', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"balanced","require_parameters":true}'::jsonb, '{"temperature":0.45}'::jsonb),
        ('VISUAL_DIRECTIONS_GENERATE', 'PREMIUM', 'TEXT', 'openai/gpt-5.6-sol', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"exacto","require_parameters":true}'::jsonb, '{"temperature":0.45}'::jsonb),
        ('VISUAL_VARIATION_GENERATE', 'FAST', 'TEXT', 'openai/gpt-5.6-luna', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"nitro","require_parameters":true}'::jsonb, '{"temperature":0.45}'::jsonb),
        ('VISUAL_VARIATION_GENERATE', 'BALANCED', 'TEXT', 'openai/gpt-5.6-terra', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"balanced","require_parameters":true}'::jsonb, '{"temperature":0.5}'::jsonb),
        ('VISUAL_VARIATION_GENERATE', 'PREMIUM', 'TEXT', 'openai/gpt-5.6-sol', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"exacto","require_parameters":true}'::jsonb, '{"temperature":0.5}'::jsonb),
        ('LOGO_CONCEPTS_GENERATE', 'FAST', 'IMAGE', 'openai/gpt-5-image-mini', ARRAY['openai/gpt-image-2'], '{"route":"nitro","require_parameters":true}'::jsonb, '{"quality":"medium","size":"1024x1024","background":"transparent","output_format":"png"}'::jsonb),
        ('LOGO_CONCEPTS_GENERATE', 'BALANCED', 'IMAGE', 'openai/gpt-image-2', ARRAY['openai/gpt-5-image'], '{"route":"balanced","require_parameters":true}'::jsonb, '{"quality":"high","size":"1024x1024","background":"transparent","output_format":"png"}'::jsonb),
        ('LOGO_CONCEPTS_GENERATE', 'PREMIUM', 'IMAGE', 'openai/gpt-image-2', ARRAY['openai/gpt-5-image'], '{"route":"exacto","require_parameters":true}'::jsonb, '{"quality":"high","size":"2048x2048","background":"transparent","output_format":"png"}'::jsonb),
        ('BRAND_BOOK_NARRATIVE_GENERATE', 'FAST', 'TEXT', 'openai/gpt-5.6-luna', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"nitro","require_parameters":true}'::jsonb, '{"temperature":0.35}'::jsonb),
        ('BRAND_BOOK_NARRATIVE_GENERATE', 'BALANCED', 'TEXT', 'openai/gpt-5.6-terra', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"balanced","require_parameters":true}'::jsonb, '{"temperature":0.4}'::jsonb),
        ('BRAND_BOOK_NARRATIVE_GENERATE', 'PREMIUM', 'TEXT', 'openai/gpt-5.6-sol', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"exacto","require_parameters":true}'::jsonb, '{"temperature":0.4}'::jsonb),
        ('QUALITY_REVIEW', 'FAST', 'TEXT', 'openai/gpt-5.6-luna', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"nitro","require_parameters":true}'::jsonb, '{"temperature":0}'::jsonb),
        ('QUALITY_REVIEW', 'BALANCED', 'TEXT', 'openai/gpt-5.6-terra', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"balanced","require_parameters":true}'::jsonb, '{"temperature":0}'::jsonb),
        ('QUALITY_REVIEW', 'PREMIUM', 'TEXT', 'openai/gpt-5.6-sol', ARRAY['~anthropic/claude-sonnet-latest'], '{"route":"exacto","require_parameters":true}'::jsonb, '{"temperature":0}'::jsonb)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_model_policies`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_prompt_templates`);
    await queryRunner.query(`DROP TYPE IF EXISTS ai_modality`);
    await queryRunner.query(`DROP TYPE IF EXISTS generation_task`);
  }
}
