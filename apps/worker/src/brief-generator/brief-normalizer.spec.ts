import { describe, expect, it } from 'vitest';
import { normalizeGeneratedBrief } from './brief-normalizer.js';

describe('normalizeGeneratedBrief', () => {
  it('accepts representative Arabic/English structured brief output', () => {
    expect(
      normalizeGeneratedBrief({
        industry: 'Specialty coffee',
        languages: ['en', 'ar-EG'],
        audience: ['Remote workers', 'Students'],
        market: ['Egypt'],
        productsServices: ['Coffee subscription', 'Workspace seating'],
        positioning: 'Warm premium cafe for bilingual remote workers.',
        preferences: ['Modern', 'Warm colors', 'RTL-compatible typography'],
        constraints: ['No generic cup icon'],
        assumptions: ['Arabic content may need RTL layout'],
        confidenceWarnings: []
      })
    ).toMatchObject({
      industry: 'Specialty coffee',
      languages: ['en', 'ar-eg'],
      audience: ['Remote workers', 'Students']
    });
  });

  it('rejects duplicate list values and invalid language tags', () => {
    expect(() =>
      normalizeGeneratedBrief({
        industry: '',
        languages: ['english'],
        audience: ['Founders', 'founders'],
        market: [],
        productsServices: [],
        positioning: '',
        preferences: [],
        constraints: [],
        assumptions: [],
        confidenceWarnings: []
      })
    ).toThrow();
  });
});
