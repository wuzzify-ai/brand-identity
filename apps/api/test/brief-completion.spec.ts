import { describe, expect, it } from 'vitest';
import { calculateBriefCompletion } from '../src/briefs/brief-completion';

describe('calculateBriefCompletion', () => {
  it('returns 100 only when every required brief section is present and one language is primary', () => {
    const result = calculateBriefCompletion({
      industry: 'Hospitality',
      positioning: 'Premium local coffee for remote workers.',
      languages: [{ language_code: 'en' }, { language_code: 'ar' }],
      primaryLanguageCount: 1,
      audiences: [{ name: 'Remote workers' }],
      markets: [{ name: 'Cairo' }],
      offerings: [{ name: 'Coffee subscription' }],
      preferences: [{ text: 'Warm, modern' }],
      constraints: [{ text: 'No generic cup logo' }]
    });

    expect(result).toEqual({ completionPercent: 100, complete: true, reasons: [] });
  });

  it('returns field-level missing reasons', () => {
    const result = calculateBriefCompletion({
      industry: '',
      positioning: null,
      languages: [{ language_code: 'en' }],
      primaryLanguageCount: 0,
      audiences: [],
      markets: [],
      offerings: [],
      preferences: [],
      constraints: []
    });

    expect(result.complete).toBe(false);
    expect(result.reasons).toContain('industry is required');
    expect(result.reasons).toContain('exactly one primary language is required');
    expect(result.completionPercent).toBeLessThan(100);
  });

  it('allows a brief to have no constraints when the business has none', () => {
    const result = calculateBriefCompletion({
      industry: 'Automation',
      positioning: 'Simple workflow automation for small businesses.',
      languages: [{ language_code: 'en' }],
      primaryLanguageCount: 1,
      audiences: [{ name: 'Small businesses' }],
      markets: [{ name: 'Global' }],
      offerings: [{ name: 'Automation consulting' }],
      preferences: [{ text: 'Practical and clear' }],
      constraints: []
    });

    expect(result).toEqual({ completionPercent: 100, complete: true, reasons: [] });
  });

  it('allows a brief to have no preferences when none were supplied', () => {
    const result = calculateBriefCompletion({
      industry: 'Automation',
      positioning: 'Simple workflow automation for small businesses.',
      languages: [{ language_code: 'en' }],
      primaryLanguageCount: 1,
      audiences: [{ name: 'Small businesses' }],
      markets: [{ name: 'Global' }],
      offerings: [{ name: 'Automation consulting' }],
      preferences: [],
      constraints: []
    });

    expect(result).toEqual({ completionPercent: 100, complete: true, reasons: [] });
  });
});
