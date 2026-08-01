import { DomainError } from '../common/domain-error';

const allowedRoles = new Set(['display', 'heading', 'body', 'caption', 'arabic', 'latin', 'ui']);
const allowedWeights = new Set([100, 200, 300, 400, 500, 600, 700, 800, 900]);
const tokenPattern = /^[a-z][a-z0-9-]*$/;

export function validateFontRole(role: string): string {
  const normalized = role
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // AI may produce descriptive roles such as display-headline or
  // monospace-data-code. Keep strict validation for single-word roles while
  // accepting normalized, multi-part role tokens.
  const isCompositeRole = normalized.includes('-');

  if (!tokenPattern.test(normalized) || (!allowedRoles.has(normalized) && !isCompositeRole)) {
    throw new DomainError('VISUAL_FONT_INVALID_ROLE', `Unsupported font role: ${role}.`, 422);
  }

  return normalized;
}

export function validateFontWeights(weights: number[]): number[] {
  const normalized = [...new Set(weights)].sort((a, b) => a - b);

  if (!normalized.length || normalized.some((weight) => !allowedWeights.has(weight))) {
    throw new DomainError('VISUAL_FONT_INVALID_WEIGHT', 'Font weights must be one of 100..900 step 100.', 422);
  }

  return normalized;
}
