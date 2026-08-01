import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import { BrandAssetCategory, BrandAssetSource, BrandAssetStatus, BrandAssetVisibility } from './asset.enums';

@Entity({ name: 'brand_assets' })
@Index('ix_brand_assets_version_status', ['identityVersionId', 'status'])
@Index('ix_brand_assets_workspace_status', ['workspaceId', 'status'])
@Index('uq_brand_assets_object_key', ['objectKey'], { unique: true })
export class BrandAssetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @Column({ name: 'identity_project_id', type: 'uuid' })
  identityProjectId!: string;

  @Column({ name: 'identity_version_id', type: 'uuid' })
  identityVersionId!: string;

  @Column({ name: 'visual_direction_id', type: 'uuid', nullable: true })
  visualDirectionId!: string | null;

  @Column({ name: 'uploaded_by_user_id', type: 'uuid', nullable: true })
  uploadedByUserId!: string | null;

  @Column({ type: 'enum', enum: BrandAssetCategory, enumName: 'brand_asset_category' })
  category!: BrandAssetCategory;

  @Column({ type: 'enum', enum: BrandAssetSource, enumName: 'brand_asset_source', default: BrandAssetSource.UserUpload })
  source!: BrandAssetSource;

  @Column({ type: 'enum', enum: BrandAssetStatus, enumName: 'brand_asset_status', default: BrandAssetStatus.PendingUpload })
  status!: BrandAssetStatus;

  @Column({ type: 'enum', enum: BrandAssetVisibility, enumName: 'brand_asset_visibility', default: BrandAssetVisibility.Private })
  visibility!: BrandAssetVisibility;

  @Column({ name: 'object_key', type: 'text' })
  objectKey!: string;

  @Column({ name: 'original_filename', type: 'varchar', length: 255 })
  originalFilename!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 180, nullable: true })
  displayName!: string | null;

  @Column({ name: 'alt_text', type: 'text', nullable: true })
  altText!: string | null;

  @Column({ name: 'declared_mime_type', type: 'varchar', length: 120 })
  declaredMimeType!: string;

  @Column({ name: 'detected_mime_type', type: 'varchar', length: 120, nullable: true })
  detectedMimeType!: string | null;

  @Column({ name: 'declared_byte_size', type: 'bigint' })
  declaredByteSize!: string;

  @Column({ name: 'actual_byte_size', type: 'bigint', nullable: true })
  actualByteSize!: string | null;

  @Column({ name: 'checksum_sha256', type: 'char', length: 64, nullable: true })
  checksumSha256!: string | null;

  @Column({ type: 'integer', nullable: true })
  width!: number | null;

  @Column({ type: 'integer', nullable: true })
  height!: number | null;

  @Column({ name: 'duration_ms', type: 'integer', nullable: true })
  durationMs!: number | null;

  @Column({ name: 'public_cdn_key', type: 'text', nullable: true })
  publicCdnKey!: string | null;

  @Column({ name: 'public_cdn_url', type: 'text', nullable: true })
  publicCdnUrl!: string | null;

  @Column({ name: 'published_by_user_id', type: 'uuid', nullable: true })
  publishedByUserId!: string | null;

  @Column({ name: 'scan_status', type: 'varchar', length: 40, default: 'PENDING' })
  scanStatus!: string;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @Column({ name: 'upload_expires_at', type: 'timestamptz' })
  uploadExpiresAt!: Date;

  @Column({ name: 'uploaded_at', type: 'timestamptz', nullable: true })
  uploadedAt!: Date | null;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  @Column({ name: 'available_at', type: 'timestamptz', nullable: true })
  availableAt!: Date | null;

  @Column({ name: 'public_published_at', type: 'timestamptz', nullable: true })
  publicPublishedAt!: Date | null;

  @Column({ name: 'public_unpublished_at', type: 'timestamptz', nullable: true })
  publicUnpublishedAt!: Date | null;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @VersionColumn({ name: 'lock_version', default: 1 })
  lockVersion!: number;
}
