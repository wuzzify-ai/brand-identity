import { describe, expect, it } from 'vitest';
import { assertAllowedMimeType, detectMimeType, mimeMatchesDeclared } from '../src/assets/asset-file-validation';

describe('asset file validation', () => {
  it('detects PNG signature independently of declared filename', () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

    expect(detectMimeType(png)).toBe('image/png');
    expect(mimeMatchesDeclared('image/jpeg', detectMimeType(png))).toBe(false);
  });

  it('rejects unsupported declared MIME types', () => {
    expect(() => assertAllowedMimeType('text/html')).toThrow(/Unsupported/);
  });
});
