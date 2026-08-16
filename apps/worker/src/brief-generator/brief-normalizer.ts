import { z } from 'zod';

const languageTagPattern = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

const generatedBriefSchema = z.object({
  industry: z.string(),
  languages: z.array(z.string()),
  audience: z.array(z.string()),
  market: z.array(z.string()),
  productsServices: z.array(z.string()),
  positioning: z.string(),
  preferences: z.array(z.string()),
  constraints: z.array(z.string()),
  assumptions: z.array(z.string()).default([]),
  confidenceWarnings: z.array(z.string()).default([])
});

export interface NormalizedGeneratedBrief {
  industry: string;
  languages: string[];
  audience: string[];
  market: string[];
  productsServices: string[];
  positioning: string;
  preferences: string[];
  constraints: string[];
  assumptions: string[];
  confidenceWarnings: string[];
}

export interface NormalizeGeneratedBriefOptions {
  marketFallback?: string;
}

export function normalizeGeneratedBrief(
  value: unknown,
  options: NormalizeGeneratedBriefOptions = {}
): NormalizedGeneratedBrief {
  const parsed = generatedBriefSchema.parse(value);
  const normalizedMarket = normalizeUniqueList(parsed.market, 'market', 25, 180);
  const market = normalizedMarket.length > 0 ? normalizedMarket : normalizeMarketFallback(options.marketFallback);
  const inferredMarketAssumption =
    normalizedMarket.length === 0 && market.length > 0 ? [`Market inferred as "${market[0]}" because the brief requires a market.`] : [];

  return {
    industry: trimBounded(parsed.industry, 180),
    positioning: trimBounded(parsed.positioning, 1000),
    languages: normalizeLanguageTags(parsed.languages),
    audience: normalizeUniqueList(parsed.audience, 'audience', 25, 180),
    market,
    productsServices: normalizeUniqueList(parsed.productsServices, 'products/services', 40, 180),
    preferences: normalizeUniqueList(parsed.preferences, 'preferences', 40, 500),
    constraints: normalizeUniqueList(parsed.constraints, 'constraints', 40, 500),
    assumptions: normalizeUniqueList([...parsed.assumptions, ...inferredMarketAssumption], 'assumptions', 40, 500),
    confidenceWarnings: normalizeUniqueList(parsed.confidenceWarnings, 'confidence warnings', 40, 500)
  };
}

function normalizeLanguageTags(values: string[]): string[] {
  const normalized = normalizeUniqueList(values, 'languages', 12, 20).map((value) => value.toLowerCase());

  for (const value of normalized) {
    if (!languageTagPattern.test(value)) {
      throw new Error(`Invalid BCP-47-like language tag: ${value}.`);
    }
  }

  return normalized;
}

function normalizeUniqueList(values: string[], label: string, maxCount: number, maxLength: number): string[] {
  if (values.length > maxCount) {
    throw new Error(`Too many ${label}; maximum is ${maxCount}.`);
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = trimBounded(value, maxLength);

    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();

    if (seen.has(key)) {
      throw new Error(`Duplicate ${label} value: ${trimmed}.`);
    }

    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

function normalizeMarketFallback(value?: string): string[] {
  const fallback = trimBounded(value ?? 'Primary target market', 180);

  return fallback ? [fallback] : ['Primary target market'];
}

function trimBounded(value: string, maxLength: number): string {
  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw new Error(`Generated value exceeds maximum length ${maxLength}.`);
  }

  return trimmed;
}
