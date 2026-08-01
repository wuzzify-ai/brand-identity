import { describe, expect, it } from 'vitest';
import { assertSafeAsset, inspectAsset } from './asset-file-inspection.js';

describe('asset file inspection', () => {
  it('extracts PNG dimensions from IHDR', () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000010000000200806000000', 'hex');

    const result = inspectAsset(png);

    expect(result.detectedMimeType).toBe('image/png');
    expect(result.width).toBe(16);
    expect(result.height).toBe(32);
  });

  it('rejects unsafe SVG scripts and malware test signatures', () => {
    const unsafeSvg = Buffer.from('<svg width="10" height="10"><script>alert(1)</script></svg>');
    const eicar = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!');

    expect(() => assertSafeAsset(unsafeSvg, 'image/svg+xml')).toThrow(/Unsafe SVG/);
    expect(() => assertSafeAsset(eicar, 'application/pdf')).toThrow(/Malware/);
  });
});
