import type { MigrationInterface, QueryRunner } from 'typeorm';

export class FixOpenRouterProviderPreferences1795134000000 implements MigrationInterface {
  name = 'FixOpenRouterProviderPreferences1795134000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE ai_model_policies
      SET provider_preferences =
        CASE provider_preferences->>'route'
          WHEN 'nitro' THEN (provider_preferences - 'route') || '{"sort":"throughput"}'::jsonb
          ELSE provider_preferences - 'route'
        END,
        updated_at = now()
      WHERE provider_preferences ? 'route'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE ai_model_policies
      SET provider_preferences =
        (provider_preferences - 'sort') ||
        jsonb_build_object(
          'route',
          CASE tier
            WHEN 'FAST' THEN 'nitro'
            WHEN 'PREMIUM' THEN 'exacto'
            ELSE 'balanced'
          END
        ),
        updated_at = now()
    `);
  }
}
