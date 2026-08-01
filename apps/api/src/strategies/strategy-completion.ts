export interface StrategyCompletionInput {
  positioning?: string | null;
  valueProposition?: string | null;
  mission?: string | null;
  vision?: string | null;
  values: unknown[];
  personas: unknown[];
  messagingPillars: unknown[];
  taglines: unknown[];
  selectedTaglineCount: number;
  rules: unknown[];
}

export function calculateStrategyCompletion(input: StrategyCompletionInput) {
  const checks = [
    { ok: Boolean(input.positioning?.trim()), reason: 'positioning is required' },
    { ok: Boolean(input.valueProposition?.trim()), reason: 'value proposition is required' },
    { ok: Boolean(input.mission?.trim()), reason: 'mission is required' },
    { ok: Boolean(input.vision?.trim()), reason: 'vision is required' },
    { ok: input.values.length >= 3, reason: 'at least three values are required' },
    { ok: input.personas.length > 0, reason: 'at least one persona is required' },
    { ok: input.messagingPillars.length >= 3, reason: 'at least three messaging pillars are required' },
    { ok: input.taglines.length > 0, reason: 'at least one tagline is required' },
    { ok: input.selectedTaglineCount > 0, reason: 'at least one selected tagline is required' },
    { ok: input.rules.length > 0, reason: 'at least one brand rule is required' }
  ];
  const passed = checks.filter((check) => check.ok).length;
  const reasons = checks.filter((check) => !check.ok).map((check) => check.reason);

  return {
    completionPercent: Math.round((passed / checks.length) * 100),
    reasons,
    complete: reasons.length === 0
  };
}
