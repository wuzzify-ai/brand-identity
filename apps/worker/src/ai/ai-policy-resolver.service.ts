import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface WorkerAiPolicy {
  id: string;
  task: string;
  tier: string;
  modality: string;
  primary_model: string;
  fallback_models: string[];
  provider_preferences: Record<string, unknown>;
  request_parameters: Record<string, unknown>;
  max_attempts: number;
  timeout_ms: number;
  prompt_template_id: string;
  prompt_template_version: number;
  system_template: string;
  user_template: string;
  output_schema: Record<string, unknown>;
}

@Injectable()
export class AiPolicyResolverService {
  constructor(private readonly dataSource: DataSource) {}

  async resolve(task: string, tier: string): Promise<WorkerAiPolicy> {
    const rows = await this.dataSource.query<WorkerAiPolicy[]>(
      `SELECT policies.*, templates.id AS prompt_template_id, templates.version AS prompt_template_version,
              templates.system_template, templates.user_template, templates.output_schema
       FROM ai_model_policies policies
       JOIN ai_prompt_templates templates ON templates.task = policies.task AND templates.is_active
       WHERE policies.task = $1
         AND policies.tier = $2
         AND policies.is_active
         AND policies.effective_from <= now()
         AND policies.effective_to IS NULL
       ORDER BY policies.effective_from DESC
       LIMIT 1`,
      [task, tier]
    );

    const policy = rows[0];

    if (!policy) {
      throw new Error(`No AI policy found for ${task}/${tier}.`);
    }

    return policy;
  }
}
