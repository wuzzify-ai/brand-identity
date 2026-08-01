import { describe, expect, it } from 'vitest';
import { calculateStrategyCompletion } from '../src/strategies/strategy-completion';

describe('calculateStrategyCompletion', () => {
  it('requires all core strategy fields and minimum collection counts', () => {
    expect(
      calculateStrategyCompletion({
        positioning: 'Premium local choice.',
        valueProposition: 'Fast identity creation with human control.',
        mission: 'Help founders launch clearly.',
        vision: 'Make brand systems accessible.',
        values: ['Clear', 'Useful', 'Warm'],
        personas: [{ name: 'Founder' }],
        messagingPillars: [{}, {}, {}],
        taglines: [{ text: 'Launch clear' }],
        selectedTaglineCount: 1,
        rules: [{ text: 'Use plain language' }]
      })
    ).toEqual({ completionPercent: 100, complete: true, reasons: [] });
  });

  it('returns actionable missing reasons', () => {
    const result = calculateStrategyCompletion({
      positioning: '',
      valueProposition: null,
      mission: null,
      vision: null,
      values: ['Clear'],
      personas: [],
      messagingPillars: [{}],
      taglines: [],
      selectedTaglineCount: 0,
      rules: []
    });

    expect(result.complete).toBe(false);
    expect(result.reasons).toContain('at least three values are required');
    expect(result.reasons).toContain('at least one selected tagline is required');
  });
});
