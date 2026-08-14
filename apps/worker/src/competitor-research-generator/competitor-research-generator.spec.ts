import { describe, expect, it, vi } from 'vitest';
import { CompetitorResearchGenerator } from './competitor-research-generator.js';

describe('CompetitorResearchGenerator', () => {
  it('uses web search tools and produces a persistable competitor research artifact', async () => {
    const openRouterGenerate = vi.fn().mockResolvedValue({
      data: {
        summary: 'Nimbus competes with workflow automation tools focused on SMB operations.',
        searchQueries: ['small business workflow automation competitors'],
        limitations: ['Search evidence is a snapshot.'],
        competitors: [
          {
            name: 'Zapier',
            websiteUrl: 'https://zapier.com',
            category: 'Automation',
            positioning: 'No-code automation platform.',
            summary: 'Connects apps and automates workflows.',
            strengths: ['Large app ecosystem'],
            weaknesses: ['Can become complex at scale'],
            differentiators: ['Broad integrations'],
            evidenceSummary: 'Website positions Zapier around automation across apps.',
            citations: [
              {
                title: 'Zapier',
                url: 'https://zapier.com',
                publisher: 'Zapier',
                snippet: 'Automation platform.'
              }
            ]
          }
        ]
      },
      sanitizedRequest: {},
      rawText: '{}',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      latencyMs: 40,
      actualModel: 'test-model',
      actualProvider: 'test-provider'
    });
    const generator = new CompetitorResearchGenerator(
      {
        resolve: async () => ({
          id: 'policy-id',
          task: 'COMPETITOR_RESEARCH',
          tier: 'BALANCED',
          modality: 'TEXT',
          primary_model: 'test-model',
          fallback_models: [],
          provider_preferences: {},
          request_parameters: {},
          max_attempts: 2,
          timeout_ms: 120000,
          prompt_template_id: 'template-id',
          prompt_template_version: 1,
          system_template: '',
          user_template: '',
          output_schema: {}
        })
      } as never,
      { generate: openRouterGenerate } as never,
      {
        query: async () => [
          {
            brief_json: {
              industry: 'Automation',
              audiences: ['small businesses'],
              markets: ['US'],
              offerings: ['workflow automation']
            }
          }
        ]
      } as never
    );

    const result = await generator.generate({
      id: 'job-id',
      identityVersionId: 'version-id',
      brandContextPackageId: null,
      brandContextPackageChecksumSha256: null,
      brandContextPackage: null,
      workflowStageKey: 'STRATEGY',
      task: 'COMPETITOR_RESEARCH',
      tier: 'BALANCED',
      input: { maxCompetitors: 3 }
    });

    expect(openRouterGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          expect.objectContaining({
            type: 'openrouter:web_search'
          })
        ]
      })
    );
    expect(result).toMatchObject({
      artifactName: 'Competitor research',
      artifactKind: 'JSON',
      actualModel: 'test-model',
      actualProvider: 'test-provider'
    });
    expect(result.contentJson.competitors).toHaveLength(1);
    expect(result.persist).toBeTypeOf('function');
  });
});
