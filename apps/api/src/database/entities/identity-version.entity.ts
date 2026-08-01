import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import { IdentityVersionStatus } from './identity.enums';

@Entity({ name: 'identity_versions' })
@Index('ix_identity_versions_project_status', ['identityProjectId', 'status'])
export class IdentityVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'identity_project_id', type: 'uuid' })
  identityProjectId!: string;

  @Column({ name: 'version_number', type: 'integer' })
  versionNumber!: number;

  @Column({ type: 'enum', enum: IdentityVersionStatus, enumName: 'identity_version_status', default: IdentityVersionStatus.Draft })
  status!: IdentityVersionStatus;

  @Column({ name: 'source_version_id', type: 'uuid', nullable: true })
  sourceVersionId!: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt!: Date | null;

  @Column({ name: 'superseded_at', type: 'timestamptz', nullable: true })
  supersededAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @VersionColumn({ name: 'lock_version', default: 1 })
  lockVersion!: number;
}
