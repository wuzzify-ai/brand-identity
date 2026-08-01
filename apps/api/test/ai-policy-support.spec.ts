import { describe, expect, it } from 'vitest';
import { canonicalize, sha256Canonical } from '../src/ai/policies/canonical-hash';

describe('canonical hashing', () => {
  it('is stable for differently ordered object keys', () => {
    expect(canonicalize({ b: 2, a: 1 })).toBe(canonicalize({ a: 1, b: 2 }));
    expect(sha256Canonical({ b: 2, a: 1 })).toMatch(/^[a-f0-9]{64}$/);
  });
});
