import { describe, expect, it } from 'vitest';
import { deriveColorMetrics } from '../src/visuals/color-utils';
import { validateFontRole, validateFontWeights } from '../src/visuals/font-validation';

describe('visual validation', () => {
  it('derives RGB/HSL and WCAG contrast deterministically', () => {
    expect(deriveColorMetrics('#0f766e')).toMatchObject({
      hex: '#0F766E',
      rgb: { r: 15, g: 118, b: 110 },
      hsl: { h: 175, s: 77.44, l: 26.08 }
    });
    expect(deriveColorMetrics('#000000').contrastOnWhite).toBe(21);
  });

  it('rejects invalid hex and font data', () => {
    expect(() => deriveColorMetrics('teal')).toThrow('Invalid HEX color');
    expect(() => validateFontRole('comic')).toThrow('Unsupported font role');
    expect(() => validateFontWeights([350])).toThrow('Font weights must be one of 100..900 step 100.');
  });

  it('normalizes font roles and weights', () => {
    expect(validateFontRole('Heading')).toBe('heading');
    expect(validateFontRole('Display / Headline')).toBe('display-headline');
    expect(validateFontRole('monospace-data-code')).toBe('monospace-data-code');
    expect(validateFontWeights([700, 400, 400])).toEqual([400, 700]);
  });
});
