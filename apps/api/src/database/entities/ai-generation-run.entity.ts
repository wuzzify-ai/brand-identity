import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { GenerationJobStatus } from './generation.enums';

@Entity({ name: 'ai_generation_runs' })
@Index('ix_ai_generation_runs_job', ['generationJobId', 'startedAt'])
export class AiGenerationRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'generation_job_id', type: 'uuid' })
  generationJobId!: string;

  @Column({ name: 'brand_context_package_id', type: 'uuid', nullable: true })
  brandContextPackageId!: string | null;

  @Column({ name: 'brand_context_package_checksum_sha256', type: 'char', length: 64, nullable: true })
  brandContextPackageChecksumSha256!: string | null;

  @Column({ name: 'attempt_number', type: 'integer' })
  attemptNumber!: number;

  @Column({ name: 'prompt_template_id', type: 'uuid', nullable: true })
  promptTemplateId!: string | null;

  @Column({ name: 'model_policy_id', type: 'uuid', nullable: true })
  modelPolicyId!: string | null;

  @Column({ type: 'enum', enum: GenerationJobStatus, enumName: 'generation_job_status' })
  status!: GenerationJobStatus;

  @Column({ name: 'sanitized_request', type: 'jsonb', default: {} })
  sanitizedRequest!: Record<string, unknown>;

  @Column({ name: 'parsed_response', type: 'jsonb', nullable: true })
  parsedResponse!: Record<string, unknown> | null;

  @Column({ name: 'actual_model', type: 'varchar', length: 180, nullable: true })
  actualModel!: string | null;

  @Column({ name: 'actual_provider', type: 'varchar', length: 180, nullable: true })
  actualProvider!: string | null;

  @Column({ name: 'prompt_tokens', type: 'integer', default: 0 })
  promptTokens!: number;

  @Column({ name: 'completion_tokens', type: 'integer', default: 0 })
  completionTokens!: number;

  @Column({ name: 'total_tokens', type: 'integer', default: 0 })
  totalTokens!: number;

  @Column({ name: 'estimated_cost_micro_usd', type: 'bigint', default: 0 })
  estimatedCostMicroUsd!: string;

  @Column({ name: 'latency_ms', type: 'integer', nullable: true })
  latencyMs!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  error!: Record<string, unknown> | null;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}
