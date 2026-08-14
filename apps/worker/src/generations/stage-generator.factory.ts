import { Injectable } from '@nestjs/common';

import type { DataSource } from 'typeorm';

export interface StageGenerationJob {
  id: string;
  identityVersionId: string;
  brandContextPackageId: string | null;
  brandContextPackageChecksumSha256: string | null;
  brandContextPackage: Record<string, unknown> | null;
  workflowStageKey: string;
  task: string;
  tier: string;
  input: Record<string, unknown>;
}

export interface StageGenerationResult {
  artifactName: string;
  artifactKind: 'JSON' | 'IMAGE' | 'FILE' | 'BRAND_BOOK';
  contentJson: Record<string, unknown>;
  sanitizedRequest: Record<string, unknown>;
  parsedResponse: Record<string, unknown>;
  actualModel?: string;
  actualProvider?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostMicroUsd?: number;
  latencyMs?: number;
  persist?: (manager: Pick<DataSource['manager'], 'query'>) => Promise<void>;
}

export interface StageGenerator {
  generate(job: StageGenerationJob): Promise<StageGenerationResult>;
}

@Injectable()
export class StageGeneratorFactory {
  private readonly generators = new Map<string, StageGenerator>();

  register(task: string, generator: StageGenerator): void {
    this.generators.set(task, generator);
  }

  resolve(task: string): StageGenerator {
    const generator = this.generators.get(task);

    if (!generator) {
      throw new Error(`No stage generator registered for ${task}.`);
    }

    return generator;
  }
}
