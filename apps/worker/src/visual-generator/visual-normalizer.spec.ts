import { describe, expect, it } from 'vitest';
import { normalizeVisualBatch } from './visual-normalizer.js';

const validDirection = {
  name: 'Warm Editorial',
  thesis: 'A calm editorial identity with generous spacing and bilingual confidence.',
  rationale: 'Supports premium cafe positioning without generic coffee symbols.',
  moodKeywords: ['warm', 'editorial', 'calm'],
  principles: ['Readable first', 'Bilingual rhythm'],
  colors: [
    { tokenName: 'brand-teal', name: 'Brand teal', hex: '#0f766e', usage: 'Primary action' },
    { tokenName: 'paper', name: 'Paper', hex: '#F7F5F0', usage: 'Background' }
  ],
  fonts: [
    { role: 'heading', family: 'Inter', fallback: 'sans-serif', weights: [400, 700], supportedScripts: ['latin'], source: 'GOOGLE', licenseStatus: 'OPEN' },
    { role: 'arabic', family: 'Noto Sans Arabic', fallback: 'sans-serif', weights: [400, 700], supportedScripts: ['arabic'], source: 'GOOGLE', licenseStatus: 'OPEN' }
  ],
  imagery: ['Natural light interiors'],
  iconography: ['Simple line geometry'],
  layoutNotes: ['Large margins'],
  shapes: ['Soft rectangles'],
  spacing: ['Open vertical rhythm'],
  texture: ['Subtle paper grain'],
  motion: ['Slow fades'],
  accessibility: ['Contrast-first palette'],
  avoidList: ['Avoid generic cup icon'],
  imagePromptSpec: 'Abstract editorial brand moodboard, no logos.'
};

describe('normalizeVisualBatch', () => {
  it('accepts bilingual visual direction output and derives color metrics', () => {
    const result = normalizeVisualBatch({
      directions: [validDirection, { ...validDirection, name: 'Bold Market', thesis: 'A sharper market-led system.' }]
    });

    expect(result.directions[0]?.colors[0]).toMatchObject({
      tokenName: 'brand-teal',
      hex: '#0F766E',
      rgb: { r: 15, g: 118, b: 110 }
    });
    expect(result.directions[0]?.fonts[1]).toMatchObject({
      family: 'Noto Sans Arabic',
      licenseStatus: 'OPEN'
    });
  });

  it('rejects invalid colors and duplicate directions', () => {
    expect(() => normalizeVisualBatch({ directions: [{ ...validDirection, colors: [{ ...validDirection.colors[0], hex: 'teal' }] }] })).toThrow(
      'Invalid HEX color'
    );
    expect(() => normalizeVisualBatch({ directions: [validDirection, validDirection] })).toThrow(
      'Generated visual directions are not meaningfully distinct.'
    );
  });

  it('removes protected-logo copy instructions', () => {
    const result = normalizeVisualBatch({
      directions: [{ ...validDirection, avoidList: ['copy Nike logo exactly', 'Avoid generic symbols'] }]
    });

    expect(result.directions[0]?.avoidList).toEqual(['Avoid generic symbols']);
  });

  it('normalizes human-readable font roles from provider output', () => {
    const result = normalizeVisualBatch({
      directions: [{
        ...validDirection,
        fonts: [{ ...validDirection.fonts[0], role: 'Display / Headline', family: 'DM Sans', source: 'Fontshare', licenseStatus: 'Free for commercial use' }]
      }]
    });

    expect(result.directions[0]?.fonts[0]).toMatchObject({ role: 'display-headline', source: 'OTHER', licenseStatus: 'OPEN' });
  });
});
