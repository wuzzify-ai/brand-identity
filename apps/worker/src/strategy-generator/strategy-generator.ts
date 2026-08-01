import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { z } from 'zod';
import { AiPolicyResolverService } from '../ai/ai-policy-resolver.service.js';
import { OpenRouterStructuredTextService } from '../ai/openrouter-structured-text.service.js';
import type { StageGenerationJob, StageGenerationResult, StageGenerator } from '../generations/stage-generator.factory.js';
import { normalizeGeneratedStrategy, type NormalizedGeneratedStrategy } from './strategy-normalizer.js';

const strategyInputSchema = z.object({
  mode: z.enum(['full', 'section']).default('full'),
  section: z.string().optional(),
  userInstructions: z.string().default('')
});

type StrategyInput = z.infer<typeof strategyInputSchema>;

const stringArraySchema = { type: 'array', items: { type: 'string' } };
const generatedStrategyOutputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    positioning: { type: 'string' },
    valueProposition: { type: 'string' },
    mission: { type: 'string' },
    vision: { type: 'string' },
    values: stringArraySchema,
    personas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          segment: { type: 'string' },
          needs: stringArraySchema,
          pains: stringArraySchema
        },
        required: ['name', 'segment', 'needs', 'pains']
      }
    },
    messagingPillars: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          message: { type: 'string' },
          proofPoints: stringArraySchema
        },
        required: ['title', 'message', 'proofPoints']
      }
    },
    taglines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
          languageCode: { type: 'string' },
          isSelected: { type: 'boolean' },
          legalReviewRequired: { type: 'boolean' }
        },
        required: ['text', 'languageCode', 'isSelected', 'legalReviewRequired']
      }
    },
    rules: stringArraySchema
  },
  required: ['positioning', 'valueProposition', 'mission', 'vision', 'values', 'personas', 'messagingPillars', 'taglines', 'rules']
};

@Injectable()
export class StrategyGenerator implements StageGenerator {
  constructor(
    private readonly policies: AiPolicyResolverService,
    private readonly openRouter: OpenRouterStructuredTextService,
    @InjectDataSource()
    private readonly dataSource: DataSource
  ) {}

  async generate(job: StageGenerationJob): Promise<StageGenerationResult> {
    const input = strategyInputSchema.parse(job.input);
    const policy = await this.policies.resolve(job.task, job.tier);
    const brief = await this.loadConfirmedBrief(job.identityVersionId);

    const response = await this.openRouter.generate({
      policy: { ...policy, output_schema: generatedStrategyOutputSchema },
      schemaName:
        job.task === 'STRATEGY_SECTION_REGENERATE'
          ? 'brand_identity_ai_strategy_section_regenerate_v1'
          : 'brand_identity_ai_strategy_generate_v1',
      userKey: job.id,
      messages: this.messages(job.task, input, brief)
    });
    const normalized = normalizeGeneratedStrategy(response.data, brief.constraints);

    const result: StageGenerationResult = {
      artifactName: input.mode === 'section' ? `Regenerated strategy ${input.section}` : 'Generated strategy',
      artifactKind: 'JSON',
      contentJson: { ...normalized },
      sanitizedRequest: response.sanitizedRequest,
      parsedResponse: { ...normalized },
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      totalTokens: response.totalTokens,
      latencyMs: response.latencyMs,
      persist: (manager) => this.persistStrategy(manager, job.identityVersionId, input, normalized)
    };

    if (response.actualModel) result.actualModel = response.actualModel;
    if (response.actualProvider) result.actualProvider = response.actualProvider;

    return result;
  }

  private async loadConfirmedBrief(identityVersionId: string) {
    const rows = await this.dataSource.query<Array<{ brief_json: unknown }>>(
      `SELECT jsonb_build_object(
        'industry', brand_briefs.industry,
        'positioning', brand_briefs.positioning,
        'languages', COALESCE((SELECT jsonb_agg(language_code ORDER BY sort_order) FROM brand_brief_languages WHERE brand_brief_id = brand_briefs.id), '[]'::jsonb),
        'audiences', COALESCE((SELECT jsonb_agg(name ORDER BY sort_order) FROM brand_brief_audiences WHERE brand_brief_id = brand_briefs.id), '[]'::jsonb),
        'markets', COALESCE((SELECT jsonb_agg(name ORDER BY sort_order) FROM brand_brief_markets WHERE brand_brief_id = brand_briefs.id), '[]'::jsonb),
        'offerings', COALESCE((SELECT jsonb_agg(name ORDER BY sort_order) FROM brand_brief_offerings WHERE brand_brief_id = brand_briefs.id), '[]'::jsonb),
        'preferences', COALESCE((SELECT jsonb_agg(text ORDER BY sort_order) FROM brand_brief_preferences WHERE brand_brief_id = brand_briefs.id), '[]'::jsonb),
        'constraints', COALESCE((SELECT jsonb_agg(text ORDER BY sort_order) FROM brand_brief_constraints WHERE brand_brief_id = brand_briefs.id), '[]'::jsonb)
       ) AS brief_json
       FROM brand_briefs
       WHERE identity_version_id = $1 AND confirmed_at IS NOT NULL`,
      [identityVersionId]
    );
    const brief = rows[0]?.brief_json as { constraints?: string[] } | undefined;

    if (!brief) {
      throw new Error('Complete the Brief before generating Strategy.');
    }

    return { ...brief, constraints: brief.constraints ?? [] };
  }

  private messages(task: string, input: StrategyInput, brief: unknown): Array<{ role: 'system' | 'user'; content: string }> {
    return [
      {
        role: 'system',
        content: [
          'You generate editable brand strategy as strict JSON from the saved confirmed brief only.',
          'Do not invent competitors, market facts, legal claims, awards, or certifications.',
          'Label uncertainty in cautious language inside rules or proof points.',
          'Respect brief constraints and requested languages.',
          'Create distinct non-duplicate values, personas, messaging pillars, taglines, and rules.',
          'Taglines must include languageCode, isSelected, and legalReviewRequired.'
        ].join(' ')
      },
      {
        role: 'user',
        content: JSON.stringify({
          task,
          mode: input.mode,
          section: input.section,
          userInstructions: input.userInstructions,
          confirmedBrief: brief
        })
      }
    ];
  }

  private async persistStrategy(
    manager: Pick<DataSource['manager'], 'query'>,
    identityVersionId: string,
    input: StrategyInput,
    strategy: NormalizedGeneratedStrategy
  ): Promise<void> {
    const row = await ensureStrategy(manager, identityVersionId);
    const apply = (section: string) => input.mode === 'full' || input.section === section;

    if (apply('root')) {
      await manager.query(
        `UPDATE brand_strategies
         SET positioning = $2, value_proposition = $3, mission = $4, vision = $5,
             origin = 'AI', updated_at = now(), lock_version = lock_version + 1
         WHERE id = $1`,
        [row.id, strategy.positioning, strategy.valueProposition, strategy.mission, strategy.vision]
      );
    }

    if (apply('values')) await replaceValues(manager, row.id, strategy.values);
    if (apply('personas')) await replacePersonas(manager, row.id, strategy.personas);
    if (apply('messagingPillars')) await replacePillars(manager, row.id, strategy.messagingPillars);
    if (apply('taglines')) await replaceTaglines(manager, row.id, strategy.taglines);
    if (apply('rules')) await replaceRules(manager, row.id, strategy.rules);

    await recalculateStrategyCompletion(manager, row.id);
  }
}

async function ensureStrategy(manager: Pick<DataSource['manager'], 'query'>, identityVersionId: string): Promise<{ id: string }> {
  const rows = await manager.query<Array<{ id: string }>>(
    `INSERT INTO brand_strategies (identity_version_id, origin)
     VALUES ($1, 'AI')
     ON CONFLICT (identity_version_id) DO UPDATE SET identity_version_id = EXCLUDED.identity_version_id
     RETURNING id`,
    [identityVersionId]
  );

  return rows[0] as { id: string };
}

async function replaceValues(manager: Pick<DataSource['manager'], 'query'>, strategyId: string, values: string[]) {
  await manager.query(`DELETE FROM brand_strategy_values WHERE brand_strategy_id = $1`, [strategyId]);
  for (const [index, value] of values.entries()) {
    await manager.query(`INSERT INTO brand_strategy_values (brand_strategy_id, text, origin, sort_order) VALUES ($1, $2, 'AI', $3)`, [
      strategyId,
      value,
      index
    ]);
  }
}

async function replaceRules(manager: Pick<DataSource['manager'], 'query'>, strategyId: string, rules: string[]) {
  await manager.query(`DELETE FROM brand_strategy_rules WHERE brand_strategy_id = $1`, [strategyId]);
  for (const [index, rule] of rules.entries()) {
    await manager.query(
      `INSERT INTO brand_strategy_rules (brand_strategy_id, text, legal_review_required, origin, sort_order) VALUES ($1, $2, false, 'AI', $3)`,
      [strategyId, rule, index]
    );
  }
}

async function replacePersonas(
  manager: Pick<DataSource['manager'], 'query'>,
  strategyId: string,
  personas: NormalizedGeneratedStrategy['personas']
) {
  await manager.query(`DELETE FROM brand_strategy_personas WHERE brand_strategy_id = $1`, [strategyId]);
  for (const [index, persona] of personas.entries()) {
    await manager.query(
      `INSERT INTO brand_strategy_personas (brand_strategy_id, name, segment, needs, pains, origin, sort_order)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 'AI', $6)`,
      [strategyId, persona.name, persona.segment, JSON.stringify(persona.needs), JSON.stringify(persona.pains), index]
    );
  }
}

async function replacePillars(
  manager: Pick<DataSource['manager'], 'query'>,
  strategyId: string,
  pillars: NormalizedGeneratedStrategy['messagingPillars']
) {
  await manager.query(`DELETE FROM brand_strategy_messaging_pillars WHERE brand_strategy_id = $1`, [strategyId]);
  for (const [index, pillar] of pillars.entries()) {
    await manager.query(
      `INSERT INTO brand_strategy_messaging_pillars (brand_strategy_id, title, message, proof_points, origin, sort_order)
       VALUES ($1, $2, $3, $4::jsonb, 'AI', $5)`,
      [strategyId, pillar.title, pillar.message, JSON.stringify(pillar.proofPoints), index]
    );
  }
}

async function replaceTaglines(
  manager: Pick<DataSource['manager'], 'query'>,
  strategyId: string,
  taglines: NormalizedGeneratedStrategy['taglines']
) {
  await manager.query(`DELETE FROM brand_strategy_taglines WHERE brand_strategy_id = $1`, [strategyId]);
  for (const [index, tagline] of taglines.entries()) {
    await manager.query(
      `INSERT INTO brand_strategy_taglines (
        brand_strategy_id, text, language_code, is_selected, legal_review_required, origin, sort_order
      )
      VALUES ($1, $2, $3, $4, $5, 'AI', $6)`,
      [strategyId, tagline.text, tagline.languageCode, tagline.isSelected, tagline.legalReviewRequired, index]
    );
  }
}

async function recalculateStrategyCompletion(manager: Pick<DataSource['manager'], 'query'>, strategyId: string): Promise<void> {
  const rows = await manager.query<Array<{ completed: number; reasons: string[] }>>(
    `WITH facts AS (
       SELECT
         (positioning IS NOT NULL AND length(trim(positioning)) > 0)::int AS positioning_ok,
         (value_proposition IS NOT NULL AND length(trim(value_proposition)) > 0)::int AS value_ok,
         (mission IS NOT NULL AND length(trim(mission)) > 0)::int AS mission_ok,
         (vision IS NOT NULL AND length(trim(vision)) > 0)::int AS vision_ok,
         (SELECT (count(*) >= 3)::int FROM brand_strategy_values WHERE brand_strategy_id = brand_strategies.id) AS values_ok,
         (SELECT (count(*) > 0)::int FROM brand_strategy_personas WHERE brand_strategy_id = brand_strategies.id) AS personas_ok,
         (SELECT (count(*) >= 3)::int FROM brand_strategy_messaging_pillars WHERE brand_strategy_id = brand_strategies.id) AS pillars_ok,
         (SELECT (count(*) > 0)::int FROM brand_strategy_taglines WHERE brand_strategy_id = brand_strategies.id) AS taglines_ok,
         (SELECT (count(*) > 0)::int FROM brand_strategy_taglines WHERE brand_strategy_id = brand_strategies.id AND is_selected) AS selected_ok,
         (SELECT (count(*) > 0)::int FROM brand_strategy_rules WHERE brand_strategy_id = brand_strategies.id) AS rules_ok
       FROM brand_strategies
       WHERE id = $1
     )
     SELECT positioning_ok + value_ok + mission_ok + vision_ok + values_ok + personas_ok + pillars_ok + taglines_ok + selected_ok + rules_ok AS completed,
       ARRAY_REMOVE(ARRAY[
         CASE WHEN positioning_ok = 0 THEN 'positioning is required' END,
         CASE WHEN value_ok = 0 THEN 'value proposition is required' END,
         CASE WHEN mission_ok = 0 THEN 'mission is required' END,
         CASE WHEN vision_ok = 0 THEN 'vision is required' END,
         CASE WHEN values_ok = 0 THEN 'at least three values are required' END,
         CASE WHEN personas_ok = 0 THEN 'at least one persona is required' END,
         CASE WHEN pillars_ok = 0 THEN 'at least three messaging pillars are required' END,
         CASE WHEN taglines_ok = 0 THEN 'at least one tagline is required' END,
         CASE WHEN selected_ok = 0 THEN 'at least one selected tagline is required' END,
         CASE WHEN rules_ok = 0 THEN 'at least one brand rule is required' END
       ], NULL) AS reasons
     FROM facts`,
    [strategyId]
  );
  const result = rows[0] ?? { completed: 0, reasons: ['strategy is required'] };

  await manager.query(
    `UPDATE brand_strategies SET completion_percent = $1, completion_reasons = $2::jsonb, updated_at = now() WHERE id = $3`,
    [Math.round((Number(result.completed) / 10) * 100), JSON.stringify(result.reasons), strategyId]
  );
}
