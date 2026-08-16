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

  it('adds a safe market fallback when AI output leaves markets empty', () => {
    expect(
      normalizeGeneratedBrief(
        {
          industry: 'Automation software',
          languages: ['en'],
          audience: ['Small business owners'],
          market: [],
          productsServices: ['Workflow automation'],
          positioning: 'Simple automation for growing small businesses.',
          preferences: ['Clean', 'Reliable'],
          constraints: [],
          assumptions: [],
          confidenceWarnings: []
        },
        { marketFallback: 'Small-business automation market' }
      )
    ).toMatchObject({
      market: ['Small-business automation market'],
      assumptions: ['Market inferred as "Small-business automation market" because the brief requires a market.']
    });
  });
});
