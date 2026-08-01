import { describe, expect, it } from 'vitest';
import type { BriefAggregate } from '../src/lib/brief-api';

describe('BriefAggregate shape', () => {
  it('supports the editable brief aggregate returned by the API', () => {
    const aggregate: BriefAggregate = {
      brief: {
        id: 'brief-id',
        identity_version_id: 'version-id',
        industry: 'Hospitality',
        positioning: 'Warm local cafe.',
        completion_percent: 100,
        completion_reasons: [],
        confirmed_at: null,
        lock_version: 2
      },
      languages: [
        {
          id: 'language-id',
          language_code: 'ar-EG',
          display_name: 'Arabic',
          is_primary: true,
          origin: 'AI',
          sort_order: 0
        }
      ],
      audiences: [],
      markets: [],
      offerings: [],
      preferences: [],
      constraints: []
    };

    expect(aggregate.languages[0]?.origin).toBe('AI');
    expect(aggregate.brief.lock_version).toBe(2);
  });
});
