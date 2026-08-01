import { z } from 'zod';

const stringList = z.array(z.string());

const generatedStrategySchema = z.object({
  positioning: z.string(),
  valueProposition: z.string(),
  mission: z.string(),
  vision: z.string(),
  values: stringList,
  personas: z.array(
    z.object({
      name: z.string(),
      segment: z.string().default(''),
      needs: stringList.default([]),
      pains: stringList.default([])
    })
  ),
  messagingPillars: z.array(
    z.object({
      title: z.string(),
      message: z.string(),
      proofPoints: stringList.default([])
    })
  ),
  taglines: z.array(
    z.object({
      text: z.string(),
      languageCode: z.string().default('en'),
      isSelected: z.boolean().default(false),
      legalReviewRequired: z.boolean().default(true)
    })
  ),
  rules: stringList
});

export type NormalizedGeneratedStrategy = z.infer<typeof generatedStrategySchema>;

export function normalizeGeneratedStrategy(value: unknown, briefConstraints: string[] = []): NormalizedGeneratedStrategy {
  const parsed = generatedStrategySchema.parse(value);
  const normalized: NormalizedGeneratedStrategy = {
    positioning: trimBounded(parsed.positioning, 1200),
    valueProposition: trimBounded(parsed.valueProposition, 1200),
    mission: trimBounded(parsed.mission, 800),
    vision: trimBounded(parsed.vision, 800),
    values: normalizeUniqueList(parsed.values, 'values', 12, 120),
    personas: parsed.personas.map((persona) => ({
      name: trimBounded(persona.name, 180),
      segment: trimBounded(persona.segment, 500),
      needs: normalizeUniqueList(persona.needs, `${persona.name} needs`, 12, 180),
      pains: normalizeUniqueList(persona.pains, `${persona.name} pains`, 12, 180)
    })),
    messagingPillars: parsed.messagingPillars.map((pillar) => ({
      title: trimBounded(pillar.title, 180),
      message: trimBounded(pillar.message, 1000),
      proofPoints: normalizeUniqueList(pillar.proofPoints, `${pillar.title} proof points`, 12, 220)
    })),
    taglines: parsed.taglines.map((tagline) => ({
      text: trimBounded(tagline.text, 120),
      languageCode: trimBounded(tagline.languageCode, 20).toLowerCase(),
      isSelected: tagline.isSelected,
      legalReviewRequired: tagline.legalReviewRequired
    })),
    rules: normalizeUniqueList(parsed.rules, 'rules', 24, 300)
  };

  assertUnique(normalized.personas.map((persona) => persona.name), 'persona names');
  assertUnique(normalized.messagingPillars.map((pillar) => pillar.title), 'messaging pillar titles');
  assertUnique(normalized.taglines.map((tagline) => `${tagline.languageCode}:${tagline.text}`), 'taglines');
  assertNoBriefContradictions(normalized, briefConstraints);

  return normalized;
}

function normalizeUniqueList(values: string[], label: string, maxCount: number, maxLength: number): string[] {
  if (values.length > maxCount) {
    throw new Error(`Too many ${label}; maximum is ${maxCount}.`);
  }

  const normalized = values.map((value) => trimBounded(value, maxLength)).filter(Boolean);
  assertUnique(normalized, label);
  return normalized;
}

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>();

  for (const value of values) {
    const key = value.toLowerCase();

    if (seen.has(key)) {
      throw new Error(`Duplicate ${label}: ${value}.`);
    }

    seen.add(key);
  }
}

function trimBounded(value: string, maxLength: number): string {
  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw new Error(`Generated strategy value exceeds maximum length ${maxLength}.`);
  }

  return trimmed;
}

function assertNoBriefContradictions(strategy: NormalizedGeneratedStrategy, constraints: string[]): void {
  const strategyText = JSON.stringify(strategy).toLowerCase();

  for (const constraint of constraints) {
    const normalized = constraint.toLowerCase();

    if (normalized.includes('no ') || normalized.includes('avoid ')) {
      const forbidden = normalized.replace(/^.*?(no|avoid)\s+/u, '').split(/[,.]/u)[0]?.trim();

      if (forbidden && strategyText.includes(forbidden)) {
        throw new Error(`Strategy contradicts brief constraint: ${constraint}.`);
      }
    }
  }
}
