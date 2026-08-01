import { describe, expect, it } from 'vitest';
import type { VisualDirectionAggregate } from '../src/lib/visual-directions-api';

describe('VisualDirectionAggregate shape', () => {
  it('supports palette contrast and font license metadata', () => {
    const aggregate: VisualDirectionAggregate = {
      direction: {
        id: 'direction-id',
        name: 'Editorial calm',
        rationale: 'A calm and trustworthy visual system.',
        mood_keywords: ['calm', 'premium'],
        imagery: ['soft product photography'],
        layout_notes: ['high contrast CTAs'],
        is_selected: true,
        lock_version: 2,
        origin: 'AI'
      },
      colors: [
        {
          id: 'color-id',
          token_name: 'brand-primary',
          name: 'Deep Teal',
          hex: '#0F766E',
          rgb: { r: 15, g: 118, b: 110 },
          hsl: { h: 175, s: 77, l: 26 },
          usage: 'Primary actions',
          contrast_on_white: '5.21',
          contrast_on_black: '4.03'
        }
      ],
      fonts: [
        {
          id: 'font-id',
          role: 'heading',
          family: 'Inter',
          fallback: 'sans-serif',
          weights: [400, 700],
          supported_scripts: ['latin'],
          source: 'GOOGLE',
          license_status: 'OPEN'
        }
      ]
    };

    expect(aggregate.colors[0]?.contrast_on_white).toBe('5.21');
    expect(aggregate.fonts[0]?.license_status).toBe('OPEN');
    expect(aggregate.direction.is_selected).toBe(true);
  });
});
