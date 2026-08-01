import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AssetVariantKind } from './asset.enums';

@Entity({ name: 'asset_variants' })
@Index('ix_asset_variants_asset_kind', ['brandAssetId', 'kind'])
@Index('uq_asset_variants_object_key', ['objectKey'], { unique: true })
export class AssetVariantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'brand_asset_id', type: 'uuid' })
  brandAssetId!: string;

  @Column({ type: 'enum', enum: AssetVariantKind, enumName: 'asset_variant_kind' })
  kind!: AssetVariantKind;

  @Column({ name: 'object_key', type: 'text' })
  objectKey!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 120 })
  mimeType!: string;

  @Column({ name: 'byte_size', type: 'bigint' })
  byteSize!: string;

  @Column({ name: 'checksum_sha256', type: 'char', length: 64 })
  checksumSha256!: string;

  @Column({ type: 'integer', nullable: true })
  width!: number | null;

  @Column({ type: 'integer', nullable: true })
  height!: number | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
