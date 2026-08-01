import { describe, expect, it } from 'vitest';
import { normalizeGeneratedStrategy } from './strategy-normalizer.js';

const validStrategy = {
  positioning: 'The bilingual premium launch partner for independent cafes.',
  valueProposition: 'Clear identity systems that help cafes launch faster.',
  mission: 'Help founders present a consistent brand from day one.',
  vision: 'Make thoughtful branding accessible to small businesses.',
  values: ['Clarity', 'Warmth', 'Craft'],
  personas: [{ name: 'Cafe founder', segment: 'Independent hospitality', needs: ['Speed'], pains: ['Generic design'] }],
  messagingPillars: [
    { title: 'Launch-ready', message: 'Everything needed for first touchpoints.', proofPoints: ['Tokens', 'Book'] },
    { title: 'Bilingual', message: 'Arabic and English are planned together.', proofPoints: ['RTL-aware'] },
    { title: 'Distinct', message: 'Strategy avoids generic cafe tropes.', proofPoints: ['Constraints-led'] }
  ],
  taglines: [
    { text: 'Launch warm', languageCode: 'en', isSelected: true, legalReviewRequired: true },
    { text: 'ابدأ بوضوح', languageCode: 'ar-EG', isSelected: true, legalReviewRequired: true }
  ],
  rules: ['Avoid generic cup icons']
};

describe('normalizeGeneratedStrategy', () => {
  it('accepts valid bilingual strategy output', () => {
    expect(normalizeGeneratedStrategy(validStrategy)).toMatchObject({
      valueProposition: 'Clear identity systems that help cafes launch faster.',
      taglines: [{ languageCode: 'en' }, { languageCode: 'ar-eg' }]
    });
  });

  it('rejects duplicate collection values', () => {
    expect(() =>
      normalizeGeneratedStrategy({
        ...validStrategy,
        values: ['Clarity', 'clarity', 'Craft']
      })
    ).toThrow('Duplicate values');
  });

  it('rejects obvious contradictions against brief constraints', () => {
    expect(() => normalizeGeneratedStrategy(validStrategy, ['No cup icons'])).toThrow('Strategy contradicts brief constraint');
  });
});
