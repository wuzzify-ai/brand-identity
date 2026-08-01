import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import type { DataSource } from 'typeorm';
import { redisConnectionOptions } from '../generations/redis-connection-options.js';
import { AssetObjectStorage } from './asset-object-storage.js';
import { assertSafeAsset, inspectAsset, mimeMatchesDeclared } from './asset-file-inspection.js';

const queueName = 'brand-identity-assets';

type AssetQueuePayload = {
  assetId: string;
};

type AssetRow = {
  id: string;
  identity_version_id: string;
  status: string;
  object_key: string;
  declared_mime_type: string;
  declared_byte_size: string;
  actual_byte_size: string | null;
  checksum_sha256: string | null;
};

@Injectable()
export class AssetProcessingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AssetProcessingService.name);
  private worker?: Worker<AssetQueuePayload>;

  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly storage: AssetObjectStorage
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<AssetQueuePayload>(
      queueName,
      (job) => this.process(job),
      {
        connection: redisConnectionOptions(this.config.getOrThrow<string>('REDIS_URL')),
        concurrency: this.config.get<number>('WORKER_CONCURRENCY') ?? 2,
        stalledInterval: 30_000,
        maxStalledCount: 2
      }
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Asset processing queue job ${job?.id ?? 'unknown'} failed: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(queueJob: Job<AssetQueuePayload>): Promise<void> {
    const asset = await this.startProcessing(queueJob.data.assetId);
    if (!asset) {
      return;
    }

    try {
      const buffer = await this.storage.readObject(asset.object_key);
      const inspection = inspectAsset(buffer);

      if (inspection.byteSize !== Number(asset.declared_byte_size) || Number(asset.actual_byte_size ?? inspection.byteSize) !== inspection.byteSize) {
        throw new Error('Stored object size does not match asset metadata.');
      }
      if (asset.checksum_sha256 && asset.checksum_sha256 !== inspection.checksumSha256) {
        throw new Error('Stored object checksum does not match asset metadata.');
      }
      if (!mimeMatchesDeclared(asset.declared_mime_type, inspection.detectedMimeType)) {
        throw new Error('Stored object MIME signature does not match asset metadata.');
      }

      assertSafeAsset(buffer, inspection.detectedMimeType);
      await this.markAvailable(asset, inspection);
    } catch (error) {
      await this.reject(asset.id, error instanceof Error ? error.message : 'Asset processing failed.');
    }
  }

  private async startProcessing(assetId: string): Promise<AssetRow | null> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<AssetRow[]>(`SELECT * FROM brand_assets WHERE id = $1 FOR UPDATE`, [assetId]);
      const asset = rows[0];
      if (!asset || ['AVAILABLE', 'REJECTED', 'ARCHIVED'].includes(asset.status)) {
        return null;
      }
      if (!['QUARANTINED', 'PROCESSING'].includes(asset.status)) {
        throw new Error(`Asset ${assetId} cannot be processed from ${asset.status}.`);
      }

      await manager.query(
        `UPDATE brand_assets
         SET status = 'PROCESSING', scan_status = 'RUNNING', updated_at = now(), lock_version = lock_version + 1
         WHERE id = $1`,
        [asset.id]
      );
      return asset;
    });
  }

  private async markAvailable(asset: AssetRow, inspection: ReturnType<typeof inspectAsset>): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO asset_variants (
          brand_asset_id, kind, object_key, mime_type, byte_size, checksum_sha256, width, height, metadata
        )
        VALUES ($1, 'ORIGINAL', $2, $3, $4, $5, $6, $7, '{}'::jsonb)
        ON CONFLICT (brand_asset_id, kind) DO UPDATE
        SET object_key = EXCLUDED.object_key, mime_type = EXCLUDED.mime_type, byte_size = EXCLUDED.byte_size,
            checksum_sha256 = EXCLUDED.checksum_sha256, width = EXCLUDED.width, height = EXCLUDED.height`,
        [
          asset.id,
          asset.object_key,
          inspection.detectedMimeType,
          inspection.byteSize,
          inspection.checksumSha256,
          inspection.width,
          inspection.height
        ]
      );
      await manager.query(
        `INSERT INTO asset_variants (
          brand_asset_id, kind, object_key, mime_type, byte_size, checksum_sha256, width, height,
          metadata
        )
        VALUES ($1, 'PREVIEW', $2, $3, $4, $5, $6, $7, '{"derived": false, "reason": "preview uses original until image resizing is configured"}'::jsonb)
        ON CONFLICT (brand_asset_id, kind) DO NOTHING`,
        [
          asset.id,
          asset.object_key,
          inspection.detectedMimeType,
          inspection.byteSize,
          inspection.checksumSha256,
          inspection.width,
          inspection.height
        ]
      );
      await manager.query(
        `UPDATE brand_assets
         SET status = 'AVAILABLE', scan_status = 'PASSED', detected_mime_type = $2, actual_byte_size = $3,
             checksum_sha256 = $4, width = $5, height = $6, processed_at = now(), available_at = now(),
             updated_at = now(), lock_version = lock_version + 1
         WHERE id = $1`,
        [asset.id, inspection.detectedMimeType, inspection.byteSize, inspection.checksumSha256, inspection.width, inspection.height]
      );
      await manager.query(
        `UPDATE workflow_stages
         SET status = 'READY', completion_percent = 100, updated_at = now()
         WHERE identity_version_id = $1 AND stage_key = 'ASSETS'`,
        [asset.identity_version_id]
      );
      await manager.query(
        `UPDATE workflow_stages
         SET status = 'NOT_STARTED', updated_at = now()
         WHERE identity_version_id = $1 AND stage_key = 'FINALIZE' AND status IN ('LOCKED', 'STALE')`,
        [asset.identity_version_id]
      );
    });
  }

  private async reject(assetId: string, reason: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE brand_assets
       SET status = 'REJECTED', scan_status = 'FAILED', rejection_reason = $2, processed_at = now(),
           updated_at = now(), lock_version = lock_version + 1
       WHERE id = $1`,
      [assetId, reason]
    );
  }
}
