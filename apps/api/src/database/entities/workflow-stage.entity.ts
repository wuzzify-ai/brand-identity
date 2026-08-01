import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { WorkflowStageKey, WorkflowStageStatus } from './identity.enums';

@Entity({ name: 'workflow_stages' })
@Index('workflow_stage_version_key_unique', ['identityVersionId', 'stageKey'], { unique: true })
export class WorkflowStageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'identity_version_id', type: 'uuid' })
  identityVersionId!: string;

  @Column({ name: 'stage_key', type: 'enum', enum: WorkflowStageKey, enumName: 'workflow_stage_key' })
  stageKey!: WorkflowStageKey;

  @Column({ type: 'enum', enum: WorkflowStageStatus, enumName: 'workflow_stage_status', default: WorkflowStageStatus.Locked })
  status!: WorkflowStageStatus;

  @Column({ name: 'completion_percent', type: 'smallint', default: 0 })
  completionPercent!: number;

  @Column({ name: 'confirmed_by_user_id', type: 'uuid', nullable: true })
  confirmedByUserId!: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt!: Date | null;

  @Column({ name: 'stale_reason', type: 'text', nullable: true })
  staleReason!: string | null;

  @Column({ name: 'last_generation_job_id', type: 'uuid', nullable: true })
  lastGenerationJobId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
