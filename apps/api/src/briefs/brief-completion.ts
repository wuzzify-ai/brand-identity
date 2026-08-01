export interface BriefCompletionInput {
  industry?: string | null;
  positioning?: string | null;
  languages: unknown[];
  primaryLanguageCount: number;
  audiences: unknown[];
  markets: unknown[];
  offerings: unknown[];
  preferences: unknown[];
  constraints: unknown[];
}

export interface BriefCompletionResult {
  completionPercent: number;
  reasons: string[];
  complete: boolean;
}

export function calculateBriefCompletion(input: BriefCompletionInput): BriefCompletionResult {
  const checks = [
    { ok: Boolean(input.industry?.trim()), reason: 'industry is required' },
    { ok: Boolean(input.positioning?.trim()), reason: 'positioning is required' },
    { ok: input.languages.length > 0, reason: 'at least one language is required' },
    { ok: input.primaryLanguageCount === 1, reason: 'exactly one primary language is required' },
    { ok: input.audiences.length > 0, reason: 'at least one audience is required' },
    { ok: input.markets.length > 0, reason: 'at least one market is required' },
    { ok: input.offerings.length > 0, reason: 'at least one product/service is required' }
  ];
  const passed = checks.filter((check) => check.ok).length;
  const reasons = checks.filter((check) => !check.ok).map((check) => check.reason);

  return {
    completionPercent: Math.round((passed / checks.length) * 100),
    reasons,
    complete: reasons.length === 0
  };
}
