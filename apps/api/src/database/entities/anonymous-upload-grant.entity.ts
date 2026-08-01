import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AnonymousUploadGrantStatus } from './asset.enums';

@Entity({ name: 'anonymous_upload_grants' })
@Index('ix_anonymous_upload_grants_project_status', ['identityProjectId', 'status'])
@Index('ix_anonymous_upload_grants_asset', ['brandAssetId'])
export class AnonymousUploadGrantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'identity_project_id', type: 'uuid' })
  identityProjectId!: string;

  @Column({ name: 'identity_version_id', type: 'uuid' })
  identityVersionId!: string;

  @Column({ name: 'brand_asset_id', type: 'uuid' })
  brandAssetId!: string;

  @Column({ name: 'secret_hash', type: 'char', length: 64 })
  secretHash!: string;

  @Column({ name: 'request_ip_hash', type: 'char', length: 64 })
  requestIpHash!: string;

  @Column({ name: 'declared_byte_size', type: 'bigint' })
  declaredByteSize!: string;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt!: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'enum', enum: AnonymousUploadGrantStatus, enumName: 'anonymous_upload_grant_status', default: AnonymousUploadGrantStatus.Issued })
  status!: AnonymousUploadGrantStatus;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
