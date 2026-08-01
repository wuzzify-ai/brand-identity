import { describe, expect, it } from 'vitest';
import { getDirectionFromLocale } from '../src/lib/i18n';

describe('getDirectionFromLocale', () => {
  it('returns rtl for Arabic locales', () => {
    expect(getDirectionFromLocale('ar-EG')).toBe('rtl');
  });

  it('returns ltr for English locales', () => {
    expect(getDirectionFromLocale('en-US')).toBe('ltr');
  });
});
