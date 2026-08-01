import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AiGenerationTier, GenerationJobStatus, GenerationTask } from './generation.enums';
import { WorkflowStageKey } from './identity.enums';

@Entity({ name: 'generation_jobs' })
@Index('ix_generation_jobs_version_status', ['identityVersionId', 'status'])
export class GenerationJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @Column({ name: 'identity_version_id', type: 'uuid' })
  identityVersionId!: string;

  @Column({ name: 'workflow_stage_key', type: 'enum', enum: WorkflowStageKey, enumName: 'workflow_stage_key' })
  workflowStageKey!: WorkflowStageKey;

  @Column({ type: 'enum', enum: GenerationTask, enumName: 'generation_task' })
  task!: GenerationTask;

  @Column({ type: 'varchar', length: 30, default: AiGenerationTier.Balanced })
  tier!: AiGenerationTier;

  @Column({ type: 'enum', enum: GenerationJobStatus, enumName: 'generation_job_status', default: GenerationJobStatus.Queued })
  status!: GenerationJobStatus;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 180 })
  idempotencyKey!: string;

  @Column({ name: 'requested_by_user_id', type: 'uuid', nullable: true })
  requestedByUserId!: string | null;

  @Column({ type: 'jsonb', default: {} })
  input!: Record<string, unknown>;

  @Column({ name: 'progress_percent', type: 'smallint', default: 0 })
  progressPercent!: number;

  @Column({ name: 'progress_message', type: 'text', nullable: true })
  progressMessage!: string | null;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ name: 'max_attempts', type: 'integer', default: 2 })
  maxAttempts!: number;

  @Column({ name: 'bullmq_job_id', type: 'varchar', length: 180, nullable: true })
  bullmqJobId!: string | null;

  @Column({ name: 'cancellation_requested_at', type: 'timestamptz', nullable: true })
  cancellationRequestedAt!: Date | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt!: Date | null;

  @Column({ name: 'heartbeat_at', type: 'timestamptz', nullable: true })
  heartbeatAt!: Date | null;

  @Column({ name: 'error_code', type: 'varchar', length: 120, nullable: true })
  errorCode!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'error_details', type: 'jsonb', nullable: true })
  errorDetails!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
