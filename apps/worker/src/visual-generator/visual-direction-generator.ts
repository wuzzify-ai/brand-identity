import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { z } from 'zod';
import { AiPolicyResolverService } from '../ai/ai-policy-resolver.service.js';
import { OpenRouterStructuredTextService } from '../ai/openrouter-structured-text.service.js';
import type { StageGenerationJob, StageGenerationResult, StageGenerator } from '../generations/stage-generator.factory.js';
import { normalizeVisualBatch, type NormalizedVisualDirection } from './visual-normalizer.js';

const visualInputSchema = z.object({
  mode: z.enum(['batch', 'variation']).default('batch'),
  parentDirectionId: z.string().optional(),
  userInstructions: z.string().default('')
});

type VisualInput = z.infer<typeof visualInputSchema>;

const stringArraySchema = { type: 'array', items: { type: 'string' } };
const visualDirectionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    thesis: { type: 'string' },
    rationale: { type: 'string' },
    moodKeywords: stringArraySchema,
    principles: stringArraySchema,
    colors: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tokenName: { type: 'string' },
          name: { type: 'string' },
          hex: { type: 'string' },
          usage: { type: 'string' }
        },
        required: ['tokenName', 'name', 'hex', 'usage']
      }
    },
    fonts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string' },
          family: { type: 'string' },
          fallback: { type: 'string' },
          weights: { type: 'array', items: { type: 'number' } },
          supportedScripts: stringArraySchema,
          source: { type: 'string' },
          licenseStatus: { type: 'string' }
        },
        required: ['role', 'family', 'fallback', 'weights', 'supportedScripts', 'source', 'licenseStatus']
      }
    },
    imagery: stringArraySchema,
    iconography: stringArraySchema,
    layoutNotes: stringArraySchema,
    shapes: stringArraySchema,
    spacing: stringArraySchema,
    texture: stringArraySchema,
    motion: stringArraySchema,
    accessibility: stringArraySchema,
    avoidList: stringArraySchema,
    imagePromptSpec: { type: 'string' }
  },
  required: [
    'name',
    'thesis',
    'rationale',
    'moodKeywords',
    'principles',
    'colors',
    'fonts',
    'imagery',
    'iconography',
    'layoutNotes',
    'shapes',
    'spacing',
    'texture',
    'motion',
    'accessibility',
    'avoidList',
    'imagePromptSpec'
  ]
};
const visualBatchOutputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    // OpenRouter's strict structured-output subset does not accept minItems/maxItems.
    // normalizeVisualBatch enforces the 1–3 direction bounds after parsing.
    directions: { type: 'array', items: visualDirectionSchema }
  },
  required: ['directions']
};

@Injectable()
export class VisualDirectionGenerator implements StageGenerator {
  constructor(
    private readonly policies: AiPolicyResolverService,
    private readonly openRouter: OpenRouterStructuredTextService,
    @InjectDataSource()
    private readonly dataSource: DataSource
  ) {}

  async generate(job: StageGenerationJob): Promise<StageGenerationResult> {
    const input = visualInputSchema.parse(job.input);
    const policy = await this.policies.resolve(job.task, job.tier);
    const context = await this.loadConfirmedContext(job.identityVersionId, input.parentDirectionId);
    const response = await this.openRouter.generate({
      policy: {
        ...policy,
        // The visual response is substantially larger than text-only stages;
        // use the low-latency model for reliable local generation.
        primary_model: 'openai/gpt-5.6-luna',
        // Visual directions are a large structured response; keep reasoning bounded
        // so the UI can receive a completed job within the normal polling window.
        request_parameters: {
          ...policy.request_parameters,
          reasoning_effort: 'low',
          max_tokens: 6000
        },
        output_schema: visualBatchOutputSchema
      },
      schemaName:
        job.task === 'VISUAL_VARIATION_GENERATE'
          ? 'brand_identity_ai_visual_variation_generate_v1'
          : 'brand_identity_ai_visual_directions_generate_v1',
      userKey: job.id,
      messages: this.messages(job.task, input, context)
    });
    const normalized = normalizeVisualBatch(response.data);

    const result: StageGenerationResult = {
      artifactName: input.mode === 'variation' ? 'Visual direction variation' : 'Visual direction batch',
      artifactKind: 'JSON',
      contentJson: normalized,
      sanitizedRequest: response.sanitizedRequest,
      parsedResponse: normalized,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      totalTokens: response.totalTokens,
      latencyMs: response.latencyMs,
      persist: (manager) => this.persistDirections(manager, job.identityVersionId, normalized.directions)
    };

    if (response.actualModel) result.actualModel = response.actualModel;
    if (response.actualProvider) result.actualProvider = response.actualProvider;

    return result;
  }

  private async loadConfirmedContext(identityVersionId: string, parentDirectionId?: string) {
    const rows = await this.dataSource.query<Array<{ context_json: unknown }>>(
      `SELECT jsonb_build_object(
        'brief', (
          SELECT jsonb_build_object(
            'industry', industry,
            'positioning', positioning,
            'languages', COALESCE((SELECT jsonb_agg(language_code ORDER BY sort_order) FROM brand_brief_languages WHERE brand_brief_id = brand_briefs.id), '[]'::jsonb),
            'constraints', COALESCE((SELECT jsonb_agg(text ORDER BY sort_order) FROM brand_brief_constraints WHERE brand_brief_id = brand_briefs.id), '[]'::jsonb)
          )
          FROM brand_briefs
          WHERE identity_version_id = $1 AND confirmed_at IS NOT NULL
        ),
        'strategy', (
          SELECT jsonb_build_object(
            'positioning', positioning,
            'valueProposition', value_proposition,
            'mission', mission,
            'vision', vision,
            'values', COALESCE((SELECT jsonb_agg(text ORDER BY sort_order) FROM brand_strategy_values WHERE brand_strategy_id = brand_strategies.id), '[]'::jsonb),
            'taglines', COALESCE((SELECT jsonb_agg(text ORDER BY sort_order) FROM brand_strategy_taglines WHERE brand_strategy_id = brand_strategies.id), '[]'::jsonb),
            'rules', COALESCE((SELECT jsonb_agg(text ORDER BY sort_order) FROM brand_strategy_rules WHERE brand_strategy_id = brand_strategies.id), '[]'::jsonb)
          )
          FROM brand_strategies
          WHERE identity_version_id = $1 AND confirmed_at IS NOT NULL
        ),
        'parentDirection', (
          SELECT to_jsonb(visual_directions)
          FROM visual_directions
          WHERE id = $2 AND identity_version_id = $1 AND status = 'ACTIVE'
        )
      ) AS context_json`,
      [identityVersionId, parentDirectionId ?? null]
    );
    const context = rows[0]?.context_json as { brief?: unknown; strategy?: unknown } | undefined;

    if (!context?.brief || !context.strategy) {
      throw new Error('Complete Brief and Strategy before generating visual directions.');
    }

    return context;
  }

  private messages(task: string, input: VisualInput, context: unknown): Array<{ role: 'system' | 'user'; content: string }> {
    return [
      {
        role: 'system',
        content: [
          'Generate exactly 2 editable visual directions as strict JSON.',
          'Use only the confirmed Brief and Strategy as grounding.',
          'Do not ask to copy or imitate protected logos, named brands, or trademarked assets.',
          'References must describe abstract attributes only: geometry, contrast, rhythm, tone.',
          'Mark unknown font licenses as UNKNOWN; do not invent licensing facts.',
          'For Arabic or RTL languages, include suitable Arabic font roles and layout/accessibility guidance.',
          'Existing selected visual directions must never be selected or replaced automatically.'
        ].join(' ')
      },
      {
        role: 'user',
        content: JSON.stringify({
          task,
          mode: input.mode,
          userInstructions: input.userInstructions,
          parentDirectionId: input.parentDirectionId,
          context
        })
      }
    ];
  }

  private async persistDirections(
    manager: Pick<DataSource['manager'], 'query'>,
    identityVersionId: string,
    directions: NormalizedVisualDirection[]
  ) {
    for (const direction of directions) {
      const rows = await manager.query<Array<{ id: string }>>(
        `INSERT INTO visual_directions (
          identity_version_id, name, rationale, mood_keywords, imagery, layout_notes, origin
        )
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, 'AI')
        RETURNING id`,
        [
          identityVersionId,
          direction.name,
          `${direction.thesis}\n\n${direction.rationale}`,
          JSON.stringify(direction.moodKeywords),
          JSON.stringify([...direction.imagery, ...direction.iconography, ...direction.shapes, ...direction.texture]),
          JSON.stringify([...direction.layoutNotes, ...direction.spacing, ...direction.motion, ...direction.accessibility, ...direction.avoidList])
        ]
      );
      const directionId = rows[0]?.id as string;

      for (const [index, color] of direction.colors.entries()) {
        await manager.query(
          `INSERT INTO visual_colors (
            visual_direction_id, token_name, name, hex, rgb, hsl, usage,
            contrast_on_white, contrast_on_black, origin, sort_order
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, 'AI', $10)`,
          [
            directionId,
            color.tokenName,
            color.name,
            color.hex,
            JSON.stringify(color.rgb),
            JSON.stringify(color.hsl),
            color.usage,
            color.contrastOnWhite,
            color.contrastOnBlack,
            index
          ]
        );
      }

      for (const [index, font] of direction.fonts.entries()) {
        await manager.query(
          `INSERT INTO visual_fonts (
            visual_direction_id, role, family, fallback, weights, supported_scripts,
            source, license_status, origin, sort_order
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'AI', $9)`,
          [
            directionId,
            font.role,
            font.family,
            font.fallback,
            font.weights,
            font.supportedScripts,
            font.source,
            font.licenseStatus,
            index
          ]
        );
      }
    }
  }
}
