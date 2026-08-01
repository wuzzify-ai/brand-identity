import { z } from 'zod';
import { deriveColorMetrics, normalizeFont } from './visual-validation.js';

const stringList = z.array(z.string());

const visualDirectionSchema = z.object({
  name: z.string(),
  thesis: z.string(),
  rationale: z.string(),
  moodKeywords: stringList,
  principles: stringList.default([]),
  colors: z.array(
    z.object({
      tokenName: z.string(),
      name: z.string(),
      hex: z.string(),
      usage: z.string().default('')
    })
  ),
  fonts: z.array(
    z.object({
      role: z.string(),
      family: z.string(),
      fallback: z.string().default('sans-serif'),
      weights: z.array(z.number()).default([400]),
      supportedScripts: stringList.default([]),
      source: z.string().optional(),
      licenseStatus: z.string().optional()
    })
  ),
  imagery: stringList,
  iconography: stringList.default([]),
  layoutNotes: stringList,
  shapes: stringList.default([]),
  spacing: stringList.default([]),
  texture: stringList.default([]),
  motion: stringList.default([]),
  accessibility: stringList.default([]),
  avoidList: stringList.default([]),
  imagePromptSpec: z.string().default('')
});

const visualBatchSchema = z.object({
  directions: z.array(visualDirectionSchema).min(1).max(3)
});

export type NormalizedVisualDirection = ReturnType<typeof normalizeVisualDirection>;

export function normalizeVisualBatch(value: unknown) {
  const parsed = visualBatchSchema.parse(value);
  const directions = parsed.directions.map((direction) => normalizeVisualDirection(direction));
  assertDirectionDistinctness(directions);
  return { directions };
}

function normalizeVisualDirection(direction: z.infer<typeof visualDirectionSchema>) {
  const colors = direction.colors.map((color) => {
    const metrics = deriveColorMetrics(color.hex);
    return {
      tokenName: normalizeToken(color.tokenName),
      name: bounded(color.name, 120),
      hex: metrics.hex,
      rgb: metrics.rgb,
      hsl: metrics.hsl,
      usage: bounded(color.usage, 500),
      contrastOnWhite: metrics.contrastOnWhite,
      contrastOnBlack: metrics.contrastOnBlack
    };
  });
  const tokenSet = new Set<string>();

  for (const color of colors) {
    if (tokenSet.has(color.tokenName)) throw new Error(`Duplicate color token: ${color.tokenName}.`);
    tokenSet.add(color.tokenName);
  }

  return {
    name: bounded(direction.name, 180),
    thesis: bounded(direction.thesis, 500),
    rationale: bounded(direction.rationale, 1200),
    moodKeywords: uniqueBounded(direction.moodKeywords, 'mood keywords', 12, 80),
    principles: uniqueBounded(direction.principles, 'principles', 12, 160),
    colors,
    fonts: direction.fonts.map(normalizeFont),
    imagery: uniqueBounded(direction.imagery, 'imagery', 16, 180),
    iconography: uniqueBounded(direction.iconography, 'iconography', 16, 180),
    layoutNotes: uniqueBounded(direction.layoutNotes, 'layout notes', 16, 220),
    shapes: uniqueBounded(direction.shapes, 'shapes', 16, 120),
    spacing: uniqueBounded(direction.spacing, 'spacing', 16, 120),
    texture: uniqueBounded(direction.texture, 'texture', 16, 120),
    motion: uniqueBounded(direction.motion, 'motion', 16, 120),
    accessibility: uniqueBounded(direction.accessibility, 'accessibility', 16, 180),
    avoidList: validateAvoidList(direction.avoidList),
    imagePromptSpec: bounded(direction.imagePromptSpec, 1200)
  };
}

function assertDirectionDistinctness(directions: Array<ReturnType<typeof normalizeVisualDirection>>) {
  const names = new Set<string>();
  const thesis = new Set<string>();

  for (const direction of directions) {
    const nameKey = direction.name.toLowerCase();
    const thesisKey = direction.thesis.toLowerCase();

    if (names.has(nameKey) || thesis.has(thesisKey)) {
      throw new Error('Generated visual directions are not meaningfully distinct.');
    }

    names.add(nameKey);
    thesis.add(thesisKey);
  }
}

function validateAvoidList(values: string[]) {
  // Drop unsafe provider suggestions instead of failing the entire batch.
  return uniqueBounded(values, 'avoid list', 24, 180).filter((value) => !/copy|clone|same as|exact logo/i.test(value));
}

function uniqueBounded(values: string[], label: string, maxCount: number, maxLength: number) {
  if (values.length > maxCount) throw new Error(`Too many ${label}; maximum is ${maxCount}.`);
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = bounded(value, maxLength);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate ${label}: ${trimmed}.`);
    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

function normalizeToken(value: string) {
  const token = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]*$/.test(token)) throw new Error(`Invalid token name: ${value}.`);
  return token;
}

function bounded(value: string, maxLength: number) {
  const trimmed = value.trim();
  // Provider output is untrusted and can be more verbose than the storage limit.
  // Keep the generated direction usable by truncating at the validated boundary.
  return trimmed.slice(0, maxLength);
}
