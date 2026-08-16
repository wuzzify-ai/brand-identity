import { Injectable } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { z } from 'zod';
import { AiPolicyResolverService } from '../ai/ai-policy-resolver.service.js';
import { OpenRouterStructuredTextService } from '../ai/openrouter-structured-text.service.js';
import type { StageGenerationJob, StageGenerationResult, StageGenerator } from '../generations/stage-generator.factory.js';
import { normalizeGeneratedBrief, type NormalizedGeneratedBrief } from './brief-normalizer.js';

const briefInputSchema = z.object({
  businessDescription: z.string().default(''),
  mode: z.enum(['full', 'empty-fields', 'selected-fields']).default('full'),
  selectedFields: z.array(z.string()).default([]),
  locale: z.string().default('en'),
  constraints: z.array(z.string()).default([])
});

type BriefInput = z.infer<typeof briefInputSchema>;

const stringArraySchema = { type: 'array', items: { type: 'string' } };
const generatedBriefOutputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    industry: { type: 'string' },
    languages: stringArraySchema,
    audience: stringArraySchema,
    market: stringArraySchema,
    productsServices: stringArraySchema,
    positioning: { type: 'string' },
    preferences: stringArraySchema,
    constraints: stringArraySchema,
    assumptions: stringArraySchema,
    confidenceWarnings: stringArraySchema
  },
  required: [
    'industry',
    'languages',
    'audience',
    'market',
    'productsServices',
    'positioning',
    'preferences',
    'constraints',
    'assumptions',
    'confidenceWarnings'
  ]
};

@Injectable()
export class BriefGenerator implements StageGenerator {
  constructor(
    private readonly policies: AiPolicyResolverService,
    private readonly openRouter: OpenRouterStructuredTextService
  ) {}

  async generate(job: StageGenerationJob): Promise<StageGenerationResult> {
    const input = briefInputSchema.parse(job.input);
    const policy = await this.policies.resolve(job.task, job.tier);

    const response = await this.openRouter.generate({
      policy: { ...policy, output_schema: generatedBriefOutputSchema },
      schemaName:
        job.task === 'BRIEF_IMPROVE' ? 'brand_identity_ai_brief_improve_v1' : 'brand_identity_ai_brief_extract_v1',
      userKey: job.id,
      messages: this.messages(job.task, input)
    });
    const normalized = normalizeGeneratedBrief(response.data, {
      marketFallback: inferMarketFallback(input)
    });

    const result: StageGenerationResult = {
      artifactName: job.task === 'BRIEF_IMPROVE' ? 'Improved brief' : 'Extracted brief',
      artifactKind: 'JSON',
      contentJson: { ...normalized },
      sanitizedRequest: response.sanitizedRequest,
      parsedResponse: { ...normalized },
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      totalTokens: response.totalTokens,
      latencyMs: response.latencyMs,
      persist: (manager) => this.persistBrief(manager, job.identityVersionId, input, normalized)
    };

    if (response.actualModel) {
      result.actualModel = response.actualModel;
    }
    if (response.actualProvider) {
      result.actualProvider = response.actualProvider;
    }

    return result;
  }

  private messages(task: string, input: BriefInput): Array<{ role: 'system' | 'user'; content: string }> {
    return [
      {
        role: 'system',
        content: [
          'You extract editable brand-identity brief data as strict JSON.',
          'Leave unknown facts as empty strings or empty arrays.',
          'Never invent competitors, legal claims, certifications, countries, or business facts.',
          'The market field is required for workflow completion. If no exact geography is supplied, provide one non-empty target market segment such as "Primary target market" or an inferred market category, and explain the inference in assumptions.',
          'Use BCP-47-like language tags such as en, ar, en-US, ar-EG.',
          'Include locale and RTL needs when Arabic or another RTL language is present.',
          'Put uncertain inferences in assumptions or confidenceWarnings.'
        ].join(' ')
      },
      {
        role: 'user',
        content: JSON.stringify({
          task,
          mode: input.mode,
          selectedFields: input.selectedFields,
          locale: input.locale,
          userConstraints: input.constraints,
          businessDescription: input.businessDescription
        })
      }
    ];
  }

  private async persistBrief(
    manager: Pick<DataSource['manager'], 'query'>,
    identityVersionId: string,
    input: BriefInput,
    brief: NormalizedGeneratedBrief
  ): Promise<void> {
    const briefRow = await ensureBrief(manager, identityVersionId);
    const applyField = await this.createApplyPredicate(manager, briefRow.id, input);

    if (applyField('industry') || applyField('positioning')) {
      await manager.query(
        `UPDATE brand_briefs
         SET industry = CASE WHEN $2 THEN $3 ELSE industry END,
             positioning = CASE WHEN $4 THEN $5 ELSE positioning END,
             origin = 'AI',
             updated_at = now(),
             lock_version = lock_version + 1
         WHERE id = $1`,
        [briefRow.id, applyField('industry'), brief.industry || null, applyField('positioning'), brief.positioning || null]
      );
    }

    if (applyField('languages')) {
      await replaceLanguages(manager, briefRow.id, brief.languages);
    }
    if (applyField('audiences')) {
      await replaceNamed(manager, 'brand_brief_audiences', briefRow.id, brief.audience);
    }
    if (applyField('markets')) {
      await replaceMarkets(manager, briefRow.id, brief.market);
    }
    if (applyField('offerings')) {
      await replaceNamed(manager, 'brand_brief_offerings', briefRow.id, brief.productsServices);
    }
    if (applyField('preferences')) {
      await replaceText(manager, 'brand_brief_preferences', briefRow.id, brief.preferences);
    }
    if (applyField('constraints')) {
      await replaceText(manager, 'brand_brief_constraints', briefRow.id, brief.constraints);
    }

    await recalculateBriefCompletion(manager, briefRow.id);
  }

  private async createApplyPredicate(manager: Pick<DataSource['manager'], 'query'>, briefId: string, input: BriefInput) {
    if (input.mode === 'full') {
      return () => true;
    }

    if (input.mode === 'selected-fields') {
      const selected = new Set(input.selectedFields);
      return (field: string) => selected.has(field);
    }

    const counts = await sectionCounts(manager, briefId);
    const rootRows = await manager.query<Array<{ industry: string | null; positioning: string | null }>>(
      `SELECT industry, positioning FROM brand_briefs WHERE id = $1`,
      [briefId]
    );
    const root = rootRows[0];

    return (field: string) => {
      if (field === 'industry') {
        return !root?.industry;
      }
      if (field === 'positioning') {
        return !root?.positioning;
      }

      return (counts[field] ?? 0) === 0;
    };
  }
}

function inferMarketFallback(input: BriefInput): string {
  const description = input.businessDescription.toLowerCase();
  const locale = input.locale.toLowerCase();

  if (description.includes('egypt') || description.includes('cairo') || locale === 'ar-eg') {
    return 'Egypt';
  }
  if (description.includes('saudi') || description.includes('riyadh') || locale === 'ar-sa') {
    return 'Saudi Arabia';
  }
  if (description.includes('uae') || description.includes('dubai') || locale === 'ar-ae') {
    return 'United Arab Emirates';
  }
  if (description.includes('united states') || /\busa\b/.test(description) || locale === 'en-us') {
    return 'United States';
  }
  if (description.includes('united kingdom') || /\buk\b/.test(description) || locale === 'en-gb') {
    return 'United Kingdom';
  }

  return 'Primary target market';
}

async function ensureBrief(manager: Pick<DataSource['manager'], 'query'>, identityVersionId: string): Promise<{ id: string }> {
  const rows = await manager.query<Array<{ id: string }>>(
    `INSERT INTO brand_briefs (identity_version_id, origin)
     VALUES ($1, 'AI')
     ON CONFLICT (identity_version_id) DO UPDATE SET identity_version_id = EXCLUDED.identity_version_id
     RETURNING id`,
    [identityVersionId]
  );

  return rows[0] as { id: string };
}

async function replaceLanguages(
  manager: Pick<DataSource['manager'], 'query'>,
  briefId: string,
  languages: string[]
): Promise<void> {
  await manager.query(`DELETE FROM brand_brief_languages WHERE brand_brief_id = $1`, [briefId]);

  for (const [index, language] of languages.entries()) {
    await manager.query(
      `INSERT INTO brand_brief_languages (brand_brief_id, language_code, display_name, is_primary, origin, sort_order)
       VALUES ($1, $2, $3, $4, 'AI', $5)`,
      [briefId, language, language, index === 0, index]
    );
  }
}

async function replaceNamed(
  manager: Pick<DataSource['manager'], 'query'>,
  table: 'brand_brief_audiences' | 'brand_brief_offerings',
  briefId: string,
  values: string[]
): Promise<void> {
  await manager.query(`DELETE FROM ${table} WHERE brand_brief_id = $1`, [briefId]);

  for (const [index, value] of values.entries()) {
    await manager.query(`INSERT INTO ${table} (brand_brief_id, name, origin, sort_order) VALUES ($1, $2, 'AI', $3)`, [
      briefId,
      value,
      index
    ]);
  }
}

async function replaceMarkets(
  manager: Pick<DataSource['manager'], 'query'>,
  briefId: string,
  values: string[]
): Promise<void> {
  await manager.query(`DELETE FROM brand_brief_markets WHERE brand_brief_id = $1`, [briefId]);

  for (const [index, value] of values.entries()) {
    await manager.query(`INSERT INTO brand_brief_markets (brand_brief_id, name, origin, sort_order) VALUES ($1, $2, 'AI', $3)`, [
      briefId,
      value,
      index
    ]);
  }
}

async function replaceText(
  manager: Pick<DataSource['manager'], 'query'>,
  table: 'brand_brief_preferences' | 'brand_brief_constraints',
  briefId: string,
  values: string[]
): Promise<void> {
  await manager.query(`DELETE FROM ${table} WHERE brand_brief_id = $1`, [briefId]);

  for (const [index, value] of values.entries()) {
    await manager.query(`INSERT INTO ${table} (brand_brief_id, text, origin, sort_order) VALUES ($1, $2, 'AI', $3)`, [
      briefId,
      value,
      index
    ]);
  }
}

async function sectionCounts(manager: Pick<DataSource['manager'], 'query'>, briefId: string): Promise<Record<string, number>> {
  const rows = await manager.query<Array<{ key: string; count: string }>>(
    `SELECT 'languages' AS key, count(*) FROM brand_brief_languages WHERE brand_brief_id = $1
     UNION ALL SELECT 'audiences', count(*) FROM brand_brief_audiences WHERE brand_brief_id = $1
     UNION ALL SELECT 'markets', count(*) FROM brand_brief_markets WHERE brand_brief_id = $1
     UNION ALL SELECT 'offerings', count(*) FROM brand_brief_offerings WHERE brand_brief_id = $1
     UNION ALL SELECT 'preferences', count(*) FROM brand_brief_preferences WHERE brand_brief_id = $1
     UNION ALL SELECT 'constraints', count(*) FROM brand_brief_constraints WHERE brand_brief_id = $1`,
    [briefId]
  );

  return Object.fromEntries(rows.map((row) => [row.key, Number(row.count)]));
}

async function recalculateBriefCompletion(manager: Pick<DataSource['manager'], 'query'>, briefId: string): Promise<void> {
  const rows = await manager.query<Array<{ completed: number; reasons: string[] }>>(
    `WITH facts AS (
       SELECT
         (industry IS NOT NULL AND length(trim(industry)) > 0)::int AS industry_ok,
         (positioning IS NOT NULL AND length(trim(positioning)) > 0)::int AS positioning_ok,
         (SELECT (count(*) > 0)::int FROM brand_brief_languages WHERE brand_brief_id = brand_briefs.id) AS languages_ok,
         (SELECT (count(*) = 1)::int FROM brand_brief_languages WHERE brand_brief_id = brand_briefs.id AND is_primary) AS primary_ok,
         (SELECT (count(*) > 0)::int FROM brand_brief_audiences WHERE brand_brief_id = brand_briefs.id) AS audiences_ok,
         (SELECT (count(*) > 0)::int FROM brand_brief_markets WHERE brand_brief_id = brand_briefs.id) AS markets_ok,
         (SELECT (count(*) > 0)::int FROM brand_brief_offerings WHERE brand_brief_id = brand_briefs.id) AS offerings_ok
       FROM brand_briefs
       WHERE id = $1
     )
     SELECT
       industry_ok + positioning_ok + languages_ok + primary_ok + audiences_ok + markets_ok + offerings_ok AS completed,
       ARRAY_REMOVE(ARRAY[
         CASE WHEN industry_ok = 0 THEN 'industry is required' END,
         CASE WHEN positioning_ok = 0 THEN 'positioning is required' END,
         CASE WHEN languages_ok = 0 THEN 'at least one language is required' END,
         CASE WHEN primary_ok = 0 THEN 'exactly one primary language is required' END,
         CASE WHEN audiences_ok = 0 THEN 'at least one audience is required' END,
         CASE WHEN markets_ok = 0 THEN 'at least one market is required' END,
         CASE WHEN offerings_ok = 0 THEN 'at least one product/service is required' END
       ], NULL) AS reasons
     FROM facts`,
    [briefId]
  );
  const result = rows[0] ?? { completed: 0, reasons: ['brief is required'] };

  await manager.query(
    `UPDATE brand_briefs
     SET completion_percent = $1, completion_reasons = $2::jsonb, updated_at = now()
     WHERE id = $3`,
    [Math.round((Number(result.completed) / 7) * 100), JSON.stringify(result.reasons), briefId]
  );
}
