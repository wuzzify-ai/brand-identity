import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Injectable()
export class UsageService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService
  ) {}

  async monthlyAiUsage(workspaceId: string) {
    const budgetMicroUsd = this.config.get<number>('AI_WORKSPACE_MONTHLY_BUDGET_MICRO_USD') ?? 100_000_000;
    const rows = await this.dataSource.query(
      `SELECT generation_jobs.task,
              generation_jobs.tier,
              count(*)::int AS run_count,
              COALESCE(SUM(ai_generation_runs.prompt_tokens), 0)::int AS prompt_tokens,
              COALESCE(SUM(ai_generation_runs.completion_tokens), 0)::int AS completion_tokens,
              COALESCE(SUM(ai_generation_runs.total_tokens), 0)::int AS total_tokens,
              COALESCE(SUM(ai_generation_runs.estimated_cost_micro_usd), 0)::bigint AS estimated_cost_micro_usd
       FROM ai_generation_runs
       JOIN generation_jobs ON generation_jobs.id = ai_generation_runs.generation_job_id
       WHERE generation_jobs.workspace_id = $1
         AND ai_generation_runs.started_at >= date_trunc('month', now())
       GROUP BY generation_jobs.task, generation_jobs.tier
       ORDER BY estimated_cost_micro_usd DESC`,
      [workspaceId]
    );
    const total = rows.reduce((sum: number, row: { estimated_cost_micro_usd: string }) => sum + Number(row.estimated_cost_micro_usd), 0);

    return {
      workspaceId,
      monthStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      budgetMicroUsd,
      usedMicroUsd: total,
      percentUsed: budgetMicroUsd ? Math.round((total / budgetMicroUsd) * 100) : 100,
      thresholds: {
        warning70: total >= budgetMicroUsd * 0.7,
        warning90: total >= budgetMicroUsd * 0.9,
        hardLimit: total >= budgetMicroUsd
      },
      byTask: rows
    };
  }
}
