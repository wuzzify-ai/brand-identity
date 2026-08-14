import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { z } from 'zod';
import { AiPolicyResolverService } from '../ai/ai-policy-resolver.service.js';
import { OpenRouterStructuredTextService } from '../ai/openrouter-structured-text.service.js';
import type { StageGenerationJob, StageGenerationResult, StageGenerator } from '../generations/stage-generator.factory.js';

const competitorResearchInputSchema = z.object({
  competitorNames: z.array(z.string().min(1)).default([]),
  market: z.string().default(''),
  maxCompetitors: z.number().int().min(1).max(8).default(5),
  userInstructions: z.string().default('')
});

type CompetitorResearchInput = z.infer<typeof competitorResearchInputSchema>;

const stringArraySchema = { type: 'array', items: { type: 'string' } };
const citationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    url: { type: 'string' },
    publisher: { type: 'string' },
    snippet: { type: 'string' }
  },
  required: ['title', 'url', 'publisher', 'snippet']
};
const competitorResearchOutputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    searchQueries: stringArraySchema,
    limitations: stringArraySchema,
    competitors: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          websiteUrl: { type: 'string' },
          category: { type: 'string' },
          positioning: { type: 'string' },
          summary: { type: 'string' },
          strengths: stringArraySchema,
          weaknesses: stringArraySchema,
          differentiators: stringArraySchema,
          evidenceSummary: { type: 'string' },
          citations: { type: 'array', items: citationSchema }
        },
        required: [
          'name',
          'websiteUrl',
          'category',
          'positioning',
          'summary',
          'strengths',
          'weaknesses',
          'differentiators',
          'evidenceSummary',
          'citations'
        ]
      }
    }
  },
  required: ['summary', 'searchQueries', 'limitations', 'competitors']
};

type NormalizedCompetitorResearch = {
  summary: string;
  searchQueries: string[];
  limitations: string[];
  competitors: Array<{
    name: string;
    websiteUrl: string | null;
    category: string | null;
    positioning: string | null;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    differentiators: string[];
    evidenceSummary: string | null;
    citations: Array<{ title: string; url: string; publisher: string | null; snippet: string | null }>;
  }>;
};

@Injectable()
export class CompetitorResearchGenerator implements StageGenerator {
  constructor(
    private readonly policies: AiPolicyResolverService,
    private readonly openRouter: OpenRouterStructuredTextService,
    @InjectDataSource()
    private readonly dataSource: DataSource
  ) {}

  async generate(job: StageGenerationJob): Promise<StageGenerationResult> {
    const input = competitorResearchInputSchema.parse(job.input);
    const brief = await this.loadConfirmedBrief(job.identityVersionId);
    const policy = await this.policies.resolve(job.task, job.tier);
    const response = await this.openRouter.generate({
      policy: { ...policy, output_schema: competitorResearchOutputSchema },
      schemaName: 'brand_identity_ai_competitor_research_v1',
      userKey: job.id,
      tools: [
        {
          type: 'openrouter:web_search',
          parameters: {
            engine: 'auto',
            max_results: 5,
            max_total_results: 12,
            search_context_size: 'medium'
          }
        }
      ],
      messages: this.messages(input, brief)
    });
    const normalized = normalizeResearch(response.data, input.maxCompetitors);

    const result: StageGenerationResult = {
      artifactName: 'Competitor research',
      artifactKind: 'JSON',
      contentJson: normalized,
      sanitizedRequest: response.sanitizedRequest,
      parsedResponse: normalized,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      totalTokens: response.totalTokens,
      latencyMs: response.latencyMs,
      persist: (manager) => this.persistResearch(manager, job.id, job.identityVersionId, normalized)
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
    const brief = rows[0]?.brief_json;
    if (!brief) throw new Error('Complete the Brief before researching competitors.');
    return brief;
  }

  private messages(input: CompetitorResearchInput, brief: unknown): Array<{ role: 'system' | 'user'; content: string }> {
    return [
      {
        role: 'system',
        content: [
          'You are a brand strategy research employee.',
          'Use web search before naming or describing competitors.',
          'Return only strict JSON that matches the schema.',
          'Every competitor must include at least one citation with a URL.',
          'If evidence is weak, say so in limitations instead of inventing facts.',
          'Focus on direct and adjacent competitors relevant to the confirmed brief.'
        ].join(' ')
      },
      {
        role: 'user',
        content: JSON.stringify({
          confirmedBrief: brief,
          knownCompetitorNames: input.competitorNames,
          marketFocus: input.market,
          maxCompetitors: input.maxCompetitors,
          userInstructions: input.userInstructions
        })
      }
    ];
  }

  private async persistResearch(
    manager: Pick<DataSource['manager'], 'query'>,
    jobId: string,
    identityVersionId: string,
    research: NormalizedCompetitorResearch
  ): Promise<void> {
    await manager.query(`UPDATE competitor_researches SET is_current = false WHERE identity_version_id = $1 AND is_current`, [
      identityVersionId
    ]);
    const revisionRows = await manager.query<{ next_revision: string }[]>(
      `SELECT COALESCE(MAX(revision), 0) + 1 AS next_revision FROM competitor_researches WHERE identity_version_id = $1`,
      [identityVersionId]
    );
    const researchRows = await manager.query<{ id: string }[]>(
      `INSERT INTO competitor_researches (
        identity_version_id, generation_job_id, revision, status, summary, search_queries, limitations, metadata, is_current
       )
       VALUES ($1, $2, $3, 'READY', $4, $5::jsonb, $6::jsonb, '{}'::jsonb, true)
       RETURNING id`,
      [
        identityVersionId,
        jobId,
        Number(revisionRows[0]?.next_revision ?? 1),
        research.summary,
        JSON.stringify(research.searchQueries),
        JSON.stringify(research.limitations)
      ]
    );
    const researchId = researchRows[0]?.id as string;

    for (const [index, competitor] of research.competitors.entries()) {
      const competitorRows = await manager.query<{ id: string }[]>(
        `INSERT INTO brand_competitors (
          competitor_research_id, name, website_url, category, positioning, summary,
          strengths, weaknesses, differentiators, evidence_summary, sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11)
        RETURNING id`,
        [
          researchId,
          competitor.name,
          competitor.websiteUrl,
          competitor.category,
          competitor.positioning,
          competitor.summary,
          JSON.stringify(competitor.strengths),
          JSON.stringify(competitor.weaknesses),
          JSON.stringify(competitor.differentiators),
          competitor.evidenceSummary,
          index
        ]
      );
      const competitorId = competitorRows[0]?.id as string;
      for (const [citationIndex, citation] of competitor.citations.entries()) {
        await manager.query(
          `INSERT INTO brand_competitor_citations (
            brand_competitor_id, title, url, publisher, snippet, sort_order
          )
          VALUES ($1, $2, $3, $4, $5, $6)`,
          [competitorId, citation.title, citation.url, citation.publisher, citation.snippet, citationIndex]
        );
      }
    }
  }
}

function normalizeResearch(value: unknown, maxCompetitors: number): NormalizedCompetitorResearch {
  const parsed = z
    .object({
      summary: z.string().default(''),
      searchQueries: z.array(z.string()).default([]),
      limitations: z.array(z.string()).default([]),
      competitors: z
        .array(
          z.object({
            name: z.string().default('Unknown competitor'),
            websiteUrl: z.string().default(''),
            category: z.string().default(''),
            positioning: z.string().default(''),
            summary: z.string().default(''),
            strengths: z.array(z.string()).default([]),
            weaknesses: z.array(z.string()).default([]),
            differentiators: z.array(z.string()).default([]),
            evidenceSummary: z.string().default(''),
            citations: z
              .array(
                z.object({
                  title: z.string().default('Source'),
                  url: z.string().default(''),
                  publisher: z.string().default(''),
                  snippet: z.string().default('')
                })
              )
              .default([])
          })
        )
        .default([])
    })
    .parse(value);

  return {
    summary: parsed.summary.trim() || 'Competitor research completed with limited summary.',
    searchQueries: nonEmpty(parsed.searchQueries),
    limitations: nonEmpty(parsed.limitations),
    competitors: parsed.competitors.slice(0, maxCompetitors).map((competitor) => ({
      name: competitor.name.trim() || 'Unknown competitor',
      websiteUrl: nullable(competitor.websiteUrl),
      category: nullable(competitor.category),
      positioning: nullable(competitor.positioning),
      summary: competitor.summary.trim() || 'No summary returned.',
      strengths: nonEmpty(competitor.strengths),
      weaknesses: nonEmpty(competitor.weaknesses),
      differentiators: nonEmpty(competitor.differentiators),
      evidenceSummary: nullable(competitor.evidenceSummary),
      citations: competitor.citations
        .filter((citation) => /^https?:\/\//i.test(citation.url.trim()))
        .map((citation) => ({
          title: citation.title.trim() || 'Source',
          url: citation.url.trim(),
          publisher: nullable(citation.publisher),
          snippet: nullable(citation.snippet)
        }))
    }))
  };
}

function nonEmpty(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
