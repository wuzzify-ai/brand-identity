import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import { IdentityProjectStatus } from './identity.enums';

@Entity({ name: 'identity_projects' })
@Index('ix_identity_projects_workspace_parent', ['workspaceId', 'parentProjectId'])
@Index('ix_identity_projects_workspace_updated', ['workspaceId', 'updatedAt'])
export class IdentityProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @Column({ name: 'parent_project_id', type: 'uuid', nullable: true })
  parentProjectId!: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @Column({ type: 'varchar', length: 180 })
  name!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  slug!: string | null;

  @Column({ type: 'enum', enum: IdentityProjectStatus, enumName: 'identity_project_status', default: IdentityProjectStatus.Active })
  status!: IdentityProjectStatus;

  @Column({ name: 'public_asset_slug', type: 'varchar', length: 200, nullable: true })
  publicAssetSlug!: string | null;

  @Column({ name: 'anonymous_uploads_enabled', type: 'boolean', default: false })
  anonymousUploadsEnabled!: boolean;

  @Column({ name: 'anonymous_upload_policy', type: 'jsonb', default: () => "'{}'::jsonb" })
  anonymousUploadPolicy!: Record<string, unknown>;

  @Column({ name: 'active_version_id', type: 'uuid', nullable: true })
  activeVersionId!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @VersionColumn({ name: 'lock_version', default: 1 })
  lockVersion!: number;
}
