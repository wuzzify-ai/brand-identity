import { z } from 'zod';

export const openRouterTaskSchema = z.enum(['brief', 'strategy', 'visuals', 'logo', 'brandBook']);

export type OpenRouterTask = z.infer<typeof openRouterTaskSchema>;

export const modelPolicySchema = z.object({
  task: openRouterTaskSchema,
  primaryModel: z.string().min(1),
  fallbackModels: z.array(z.string().min(1)).default([]),
  requiresStructuredOutput: z.boolean().default(true)
});

export type ModelPolicy = z.infer<typeof modelPolicySchema>;

export const initialBriefSchema = z.object({
  industry: z.string().min(1),
  languages: z.array(z.string().min(1)),
  audience: z.array(z.string().min(1)),
  market: z.array(z.string().min(1)),
  productsServices: z.array(z.string().min(1)),
  positioning: z.string().min(1),
  preferences: z.array(z.string().min(1)),
  constraints: z.array(z.string().min(1))
});

export type InitialBrief = z.infer<typeof initialBriefSchema>;

export const generatedBriefSchema = z.object({
  industry: z.string(),
  languages: z.array(z.string()),
  audience: z.array(z.string()),
  market: z.array(z.string()),
  productsServices: z.array(z.string()),
  positioning: z.string(),
  preferences: z.array(z.string()),
  constraints: z.array(z.string()),
  assumptions: z.array(z.string().min(1)).default([]),
  confidenceWarnings: z.array(z.string().min(1)).default([])
});

export type GeneratedBrief = z.infer<typeof generatedBriefSchema>;

export const generationTaskSchema = z.enum([
  'BRIEF_EXTRACT',
  'BRIEF_IMPROVE',
  'STRATEGY_GENERATE',
  'STRATEGY_SECTION_REGENERATE',
  'VISUAL_DIRECTIONS_GENERATE',
  'VISUAL_VARIATION_GENERATE',
  'LOGO_CONCEPTS_GENERATE',
  'BRAND_BOOK_NARRATIVE_GENERATE',
  'QUALITY_REVIEW'
]);

export const aiTierSchema = z.enum(['FAST', 'BALANCED', 'PREMIUM']);

export const aiModalitySchema = z.enum(['TEXT', 'IMAGE']);

export const aiTaskContractSchema = z
  .object({
    schemaId: z.string().min(1),
    task: generationTaskSchema,
    modality: aiModalitySchema,
    inputSchema: z.record(z.unknown()),
    outputSchema: z.record(z.unknown())
  })
  .strict();

export type AiTaskContract = z.infer<typeof aiTaskContractSchema>;

const stringArraySchema = { type: 'array', items: { type: 'string' } };

const briefJsonSchema = {
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

const strategyJsonSchema = {
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
    taglines: stringArraySchema,
    rules: stringArraySchema
  },
  required: [
    'positioning',
    'valueProposition',
    'mission',
    'vision',
    'values',
    'personas',
    'messagingPillars',
    'taglines',
    'rules'
  ]
};

const visualDirectionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    rationale: { type: 'string' },
    moodKeywords: stringArraySchema,
    colors: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          hex: { type: 'string' },
          usage: { type: 'string' }
        },
        required: ['name', 'hex', 'usage']
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
          fallback: { type: 'string' }
        },
        required: ['role', 'family', 'fallback']
      }
    },
    imagery: stringArraySchema,
    layoutNotes: stringArraySchema
  },
  required: ['id', 'name', 'rationale', 'moodKeywords', 'colors', 'fonts', 'imagery', 'layoutNotes']
};

export const aiTaskContracts: AiTaskContract[] = [
  {
    schemaId: 'brand-identity.ai.brief-extract.v1',
    task: 'BRIEF_EXTRACT',
    modality: 'TEXT',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        businessDescription: { type: 'string' }
      },
      required: ['businessDescription']
    },
    outputSchema: briefJsonSchema
  },
  {
    schemaId: 'brand-identity.ai.brief-improve.v1',
    task: 'BRIEF_IMPROVE',
    modality: 'TEXT',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        currentBrief: briefJsonSchema,
        userInstructions: { type: 'string' }
      },
      required: ['currentBrief', 'userInstructions']
    },
    outputSchema: briefJsonSchema
  },
  {
    schemaId: 'brand-identity.ai.strategy-generate.v1',
    task: 'STRATEGY_GENERATE',
    modality: 'TEXT',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { brief: briefJsonSchema },
      required: ['brief']
    },
    outputSchema: strategyJsonSchema
  },
  {
    schemaId: 'brand-identity.ai.strategy-section-regenerate.v1',
    task: 'STRATEGY_SECTION_REGENERATE',
    modality: 'TEXT',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        brief: briefJsonSchema,
        strategy: strategyJsonSchema,
        section: { type: 'string' },
        userInstructions: { type: 'string' }
      },
      required: ['brief', 'strategy', 'section', 'userInstructions']
    },
    outputSchema: strategyJsonSchema
  },
  {
    schemaId: 'brand-identity.ai.visual-directions-generate.v1',
    task: 'VISUAL_DIRECTIONS_GENERATE',
    modality: 'TEXT',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        brief: briefJsonSchema,
        strategy: strategyJsonSchema
      },
      required: ['brief', 'strategy']
    },
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        directions: { type: 'array', items: visualDirectionJsonSchema }
      },
      required: ['directions']
    }
  },
  {
    schemaId: 'brand-identity.ai.visual-variation-generate.v1',
    task: 'VISUAL_VARIATION_GENERATE',
    modality: 'TEXT',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        direction: visualDirectionJsonSchema,
        userInstructions: { type: 'string' }
      },
      required: ['direction', 'userInstructions']
    },
    outputSchema: visualDirectionJsonSchema
  },
  {
    schemaId: 'brand-identity.ai.logo-concepts-generate.v1',
    task: 'LOGO_CONCEPTS_GENERATE',
    modality: 'IMAGE',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        brief: briefJsonSchema,
        strategy: strategyJsonSchema,
        visualDirection: visualDirectionJsonSchema,
        count: { type: 'integer', minimum: 1, maximum: 12 }
      },
      required: ['brief', 'strategy', 'visualDirection', 'count']
    },
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        concepts: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              rationale: { type: 'string' },
              generationPrompt: { type: 'string' },
              assetIds: stringArraySchema
            },
            required: ['title', 'rationale', 'generationPrompt', 'assetIds']
          }
        }
      },
      required: ['concepts']
    }
  },
  {
    schemaId: 'brand-identity.ai.brand-book-narrative-generate.v1',
    task: 'BRAND_BOOK_NARRATIVE_GENERATE',
    modality: 'TEXT',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        brief: briefJsonSchema,
        strategy: strategyJsonSchema,
        visualDirections: { type: 'array', items: visualDirectionJsonSchema },
        selectedAssetIds: stringArraySchema
      },
      required: ['brief', 'strategy', 'visualDirections', 'selectedAssetIds']
    },
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        chapters: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              body: { type: 'string' }
            },
            required: ['title', 'body']
          }
        }
      },
      required: ['chapters']
    }
  },
  {
    schemaId: 'brand-identity.ai.quality-review.v1',
    task: 'QUALITY_REVIEW',
    modality: 'TEXT',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        identityVersion: { type: 'object', additionalProperties: true }
      },
      required: ['identityVersion']
    },
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        score: { type: 'number', minimum: 0, maximum: 100 },
        approved: { type: 'boolean' },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
              message: { type: 'string' },
              suggestedFix: { type: 'string' }
            },
            required: ['severity', 'message', 'suggestedFix']
          }
        }
      },
      required: ['score', 'approved', 'issues']
    }
  }
];
