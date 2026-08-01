import { describe, expect, it } from 'vitest';
import type { StrategyAggregate } from '../src/lib/strategy-api';

describe('StrategyAggregate shape', () => {
  it('supports selected taglines and legal review metadata', () => {
    const aggregate: StrategyAggregate = {
      strategy: {
        id: 'strategy-id',
        positioning: 'Clear position',
        value_proposition: 'Clear value',
        mission: 'Clear mission',
        vision: 'Clear vision',
        essence: null,
        promise: null,
        completion_percent: 100,
        completion_reasons: [],
        confirmed_at: null,
        lock_version: 3
      },
      values: [],
      personas: [],
      messagingPillars: [],
      taglines: [
        {
          id: 'tagline-id',
          text: 'Launch clear',
          language_code: 'en',
          is_selected: true,
          legal_review_required: true,
          origin: 'AI',
          sort_order: 0
        }
      ],
      rules: []
    };

    expect(aggregate.taglines[0]?.is_selected).toBe(true);
    expect(aggregate.taglines[0]?.legal_review_required).toBe(true);
  });
});
