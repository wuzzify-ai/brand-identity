import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { GenerationArtifactKind } from './generation.enums';
import { WorkflowStageKey } from './identity.enums';

@Entity({ name: 'generation_artifacts' })
@Index('ix_generation_artifacts_version_stage', ['identityVersionId', 'workflowStageKey'])
export class GenerationArtifactEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'generation_job_id', type: 'uuid' })
  generationJobId!: string;

  @Column({ name: 'ai_generation_run_id', type: 'uuid', nullable: true })
  aiGenerationRunId!: string | null;

  @Column({ name: 'identity_version_id', type: 'uuid' })
  identityVersionId!: string;

  @Column({ name: 'workflow_stage_key', type: 'enum', enum: WorkflowStageKey, enumName: 'workflow_stage_key' })
  workflowStageKey!: WorkflowStageKey;

  @Column({ type: 'enum', enum: GenerationArtifactKind, enumName: 'generation_artifact_kind' })
  kind!: GenerationArtifactKind;

  @Column({ type: 'varchar', length: 180 })
  name!: string;

  @Column({ name: 'content_json', type: 'jsonb', default: {} })
  contentJson!: Record<string, unknown>;

  @Column({ name: 'asset_url', type: 'text', nullable: true })
  assetUrl!: string | null;

  @Column({ name: 'checksum_sha256', type: 'char', length: 64, nullable: true })
  checksumSha256!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
