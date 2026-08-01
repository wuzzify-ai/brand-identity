import { describe, expect, it } from 'vitest';
import { aiTaskContracts, aiTaskContractSchema, type AiTaskContract } from './index.js';

describe('aiTaskContracts', () => {
  it('defines strict schema identifiers for supported tasks', () => {
    expect(aiTaskContracts.length).toBeGreaterThan(0);
    expect(() =>
      aiTaskContracts.map((contract: AiTaskContract) => aiTaskContractSchema.parse(contract))
    ).not.toThrow();
    expect(aiTaskContracts.map((contract: AiTaskContract) => contract.schemaId)).toContain(
      'brand-identity.ai.brief-extract.v1'
    );
  });
});
