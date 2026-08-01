import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DomainError } from '../../common/domain-error';

export type AiTier = 'FAST' | 'BALANCED' | 'PREMIUM';

@Injectable()
export class AiPolicyService {
  constructor(private readonly dataSource: DataSource) {}

  async resolve(task: string, tier: AiTier, at = new Date()) {
    const rows = await this.dataSource.query(
      `SELECT policies.*, templates.id AS prompt_template_id, templates.version AS prompt_template_version,
              templates.system_template, templates.user_template, templates.input_schema, templates.output_schema
       FROM ai_model_policies policies
       JOIN ai_prompt_templates templates ON templates.task = policies.task AND templates.is_active
       WHERE policies.task = $1
         AND policies.tier = $2
         AND policies.is_active
         AND policies.effective_from <= $3
         AND policies.effective_to IS NULL
       ORDER BY policies.effective_from DESC
       LIMIT 1`,
      [task, tier, at]
    );

    if (!rows[0]) {
      throw new DomainError('AI_POLICY_NOT_FOUND', 'AI policy was not found.', 404);
    }

    return rows[0];
  }
}
