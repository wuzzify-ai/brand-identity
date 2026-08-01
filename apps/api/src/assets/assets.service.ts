import { createHash, randomBytes, randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DomainError } from '../common/domain-error';
import {
  AnonymousUploadGrantStatus,
  BrandAssetSource,
  BrandAssetStatus,
  BrandAssetVisibility,
  WorkflowStageKey,
  WorkflowStageStatus
} from '../database/entities';
import { assertAllowedMimeType, detectMimeType, mimeMatchesDeclared } from './asset-file-validation';
import { AssetProcessingQueueService } from './asset-processing-queue.service';
import type { CompleteAssetUploadDto, CreateAssetUploadDto, UpdateAssetDto } from './dto/asset.dto';
import type { CompleteAnonymousUploadDto, CreateAnonymousUploadGrantDto, PublishAssetDto } from './dto/public-asset.dto';
import { AssetUrlSigner } from './storage/asset-url-signer.service';
import { PrivateAssetStorage } from './storage/private-asset-storage.service';

type AssetRow = {
  id: string;
  workspace_id: string;
  identity_project_id: string;
  identity_version_id: string;
  visual_direction_id: string | null;
  status: BrandAssetStatus;
  object_key: string;
  original_filename: string;
  declared_mime_type: string;
  detected_mime_type: string | null;
  declared_byte_size: string;
  actual_byte_size: string | null;
  checksum_sha256: string | null;
  lock_version: number;
  upload_expires_at: Date;
  uploaded_at?: Date | null;
  display_name?: string | null;
  alt_text?: string | null;
  public_cdn_key?: string | null;
  public_cdn_url?: string | null;
};

type PublicProjectRow = {
  id: string;
  workspace_id: string;
  public_asset_slug: string;
  anonymous_uploads_enabled: boolean;
  active_version_id: string | null;
};

type AnonymousGrantRow = {
  id: string;
  identity_project_id: string;
  identity_version_id: string;
  brand_asset_id: string;
  secret_hash: string;
  declared_byte_size: string;
  expires_at: Date;
  status: AnonymousUploadGrantStatus;
};

@Injectable()
export class AssetsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly signer: AssetUrlSigner,
    private readonly storage: PrivateAssetStorage,
    private readonly queue: AssetProcessingQueueService
  ) {}

  async createUpload(workspaceId: string, projectId: string, userId: string, dto: CreateAssetUploadDto) {
    assertAllowedMimeType(dto.mimeType);

    const maxBytes = this.config.get<number>('AUTHENTICATED_UPLOAD_MAX_BYTES') ?? 25 * 1024 * 1024;
    if (dto.byteSize > maxBytes) {
      throw new DomainError('ASSET_TOO_LARGE', `Asset exceeds ${maxBytes} bytes.`, 413);
    }

    await this.assertVersionAccess(workspaceId, projectId, dto.identityVersionId);
    await this.assertAssetsUnlocked(dto.identityVersionId);
    if (dto.visualDirectionId) {
      await this.assertVisualDirectionBelongsToVersion(dto.visualDirectionId, dto.identityVersionId);
    }

    const assetId = randomUUID();
    const safeFilename = sanitizeFilename(dto.filename);
    const objectKey = `private/workspaces/${workspaceId}/versions/${dto.identityVersionId}/${assetId}/${safeFilename}`;
    const uploadTtlSeconds = this.config.get<number>('ASSET_UPLOAD_GRANT_TTL_SECONDS') ?? 900;
    const uploadExpiresAt = new Date(Date.now() + uploadTtlSeconds * 1000);

    const rows = await this.dataSource.query(
      `INSERT INTO brand_assets (
        id, workspace_id, identity_project_id, identity_version_id, visual_direction_id, uploaded_by_user_id,
        category, source, status, visibility, object_key, original_filename, display_name, alt_text,
        declared_mime_type, declared_byte_size, checksum_sha256, upload_expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        assetId,
        workspaceId,
        projectId,
        dto.identityVersionId,
        dto.visualDirectionId ?? null,
        userId,
        dto.category,
        BrandAssetSource.UserUpload,
        BrandAssetStatus.PendingUpload,
        BrandAssetVisibility.Private,
        objectKey,
        safeFilename,
        normalizeText(dto.displayName),
        normalizeText(dto.altText),
        dto.mimeType.toLowerCase(),
        dto.byteSize,
        dto.checksumSha256 ?? null,
        uploadExpiresAt
      ]
    );

    return {
      asset: rows[0],
      upload: this.buildUploadGrant(assetId, objectKey, uploadExpiresAt)
    };
  }

  async list(workspaceId: string, projectId: string, versionId: string) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    return this.dataSource.query(
      `SELECT * FROM brand_assets
       WHERE workspace_id = $1 AND identity_project_id = $2 AND identity_version_id = $3 AND status <> 'ARCHIVED'
       ORDER BY updated_at DESC, id DESC`,
      [workspaceId, projectId, versionId]
    );
  }

  async get(workspaceId: string, projectId: string, versionId: string, assetId: string) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    return this.readAggregate(assetId, workspaceId, projectId, versionId);
  }

  async completeUpload(workspaceId: string, projectId: string, versionId: string, assetId: string, dto: CompleteAssetUploadDto) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);

    const rows = await this.dataSource.query<AssetRow[]>(
      `SELECT * FROM brand_assets
       WHERE id = $1 AND workspace_id = $2 AND identity_project_id = $3 AND identity_version_id = $4
       FOR UPDATE`,
      [assetId, workspaceId, projectId, versionId]
    );
    const asset = rows[0];
    if (!asset) throw new DomainError('ASSET_NOT_FOUND', 'Asset was not found.', 404);

    if ([BrandAssetStatus.Quarantined, BrandAssetStatus.Processing, BrandAssetStatus.Available].includes(asset.status)) {
      return this.readAggregate(assetId, workspaceId, projectId, versionId);
    }
    if (asset.status !== BrandAssetStatus.PendingUpload) {
      throw new DomainError('ASSET_NOT_COMPLETABLE', `Asset cannot be completed from ${asset.status}.`, 409);
    }
    if (new Date(asset.upload_expires_at).getTime() <= Date.now()) {
      throw new DomainError('ASSET_UPLOAD_EXPIRED', 'Upload grant has expired.', 410);
    }

    const object = await this.storage.readObject(asset.object_key);
    const actualByteSize = object.byteLength;
    const actualChecksum = createHash('sha256').update(object).digest('hex');
    const detectedMimeType = detectMimeType(object);

    if (actualByteSize !== Number(asset.declared_byte_size) || (dto.byteSize && dto.byteSize !== actualByteSize)) {
      await this.reject(assetId, 'Uploaded object size does not match the declared size.');
      throw new DomainError('ASSET_SIZE_MISMATCH', 'Uploaded object size does not match the declared size.', 422);
    }
    if (asset.checksum_sha256 && asset.checksum_sha256 !== actualChecksum) {
      await this.reject(assetId, 'Uploaded object checksum does not match the declared checksum.');
      throw new DomainError('ASSET_CHECKSUM_MISMATCH', 'Uploaded object checksum does not match the declared checksum.', 422);
    }
    if (dto.checksumSha256 && dto.checksumSha256 !== actualChecksum) {
      await this.reject(assetId, 'Uploaded object checksum does not match the completion checksum.');
      throw new DomainError('ASSET_CHECKSUM_MISMATCH', 'Uploaded object checksum does not match the completion checksum.', 422);
    }
    if (!mimeMatchesDeclared(dto.mimeType ?? asset.declared_mime_type, detectedMimeType)) {
      await this.reject(assetId, 'Uploaded object MIME signature does not match the declared MIME type.');
      throw new DomainError('ASSET_MIME_MISMATCH', 'Uploaded object MIME signature does not match the declared MIME type.', 422);
    }

    await this.dataSource.query(
      `UPDATE brand_assets
       SET status = 'QUARANTINED', scan_status = 'PENDING', actual_byte_size = $2, detected_mime_type = $3,
           checksum_sha256 = $4, uploaded_at = now(), updated_at = now(), lock_version = lock_version + 1
       WHERE id = $1`,
      [assetId, actualByteSize, detectedMimeType, actualChecksum]
    );
    await this.queue.enqueue(assetId);
    await this.markAssetStageGenerating(versionId);
    return this.readAggregate(assetId, workspaceId, projectId, versionId);
  }

  async update(workspaceId: string, projectId: string, versionId: string, assetId: string, dto: UpdateAssetDto) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const rows = await this.dataSource.query(
      `UPDATE brand_assets
       SET display_name = COALESCE($5, display_name), alt_text = COALESCE($6, alt_text),
           metadata = COALESCE($7::jsonb, metadata), updated_at = now(), lock_version = lock_version + 1
       WHERE id = $1 AND workspace_id = $2 AND identity_project_id = $3 AND identity_version_id = $4
         AND lock_version = $8 AND status <> 'ARCHIVED'
       RETURNING *`,
      [
        assetId,
        workspaceId,
        projectId,
        versionId,
        normalizeText(dto.displayName),
        normalizeText(dto.altText),
        dto.metadata ? JSON.stringify(dto.metadata) : null,
        dto.lockVersion
      ]
    );
    if (!rows[0]) throw new DomainError('ASSET_UPDATE_CONFLICT', 'Asset was changed by another request.', 409);
    return this.readAggregate(assetId, workspaceId, projectId, versionId);
  }

  async archive(workspaceId: string, projectId: string, versionId: string, assetId: string, lockVersion: number) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const rows = await this.dataSource.query(
      `UPDATE brand_assets
       SET status = 'ARCHIVED', archived_at = now(), updated_at = now(), lock_version = lock_version + 1
       WHERE id = $1 AND workspace_id = $2 AND identity_project_id = $3 AND identity_version_id = $4
         AND lock_version = $5 AND status <> 'ARCHIVED'
       RETURNING id`,
      [assetId, workspaceId, projectId, versionId, lockVersion]
    );
    if (!rows[0]) throw new DomainError('ASSET_UPDATE_CONFLICT', 'Asset was changed by another request.', 409);
    return { ok: true };
  }

  async createAnonymousUploadGrant(publicSlug: string, requesterIp: string, dto: CreateAnonymousUploadGrantDto) {
    assertAllowedMimeType(dto.mimeType);
    this.assertBotChallenge(dto.botChallenge);

    const maxBytes = this.config.get<number>('ANONYMOUS_UPLOAD_MAX_BYTES') ?? 10 * 1024 * 1024;
    if (dto.byteSize > maxBytes) {
      throw new DomainError('ANONYMOUS_ASSET_TOO_LARGE', `Anonymous upload exceeds ${maxBytes} bytes.`, 413);
    }

    const project = await this.findPublicProject(publicSlug);
    if (!project.anonymous_uploads_enabled) {
      throw new DomainError('ANONYMOUS_UPLOADS_DISABLED', 'Anonymous uploads are not enabled for this project.', 404);
    }

    const identityVersionId = await this.findPublicUploadVersion(project);
    await this.assertAnonymousQuota(project.id, requesterIp);

    const grantId = randomUUID();
    const assetId = randomUUID();
    const secret = randomBytes(24).toString('base64url');
    const secretHash = this.hashSecret(secret);
    const safeFilename = sanitizeFilename(dto.filename);
    const objectKey = `anonymous/quarantine/projects/${project.id}/grants/${grantId}/${safeFilename}`;
    const ttlSeconds = this.config.get<number>('ANONYMOUS_UPLOAD_GRANT_TTL_SECONDS') ?? 900;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO brand_assets (
          id, workspace_id, identity_project_id, identity_version_id, uploaded_by_user_id,
          category, source, status, visibility, object_key, original_filename, display_name, alt_text,
          declared_mime_type, declared_byte_size, upload_expires_at, metadata
        )
        VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, $9, $10, NULL, $11, $12, $13, $14, $15::jsonb)`,
        [
          assetId,
          project.workspace_id,
          project.id,
          identityVersionId,
          dto.category,
          BrandAssetSource.Imported,
          BrandAssetStatus.PendingUpload,
          BrandAssetVisibility.Private,
          objectKey,
          safeFilename,
          normalizeText(dto.altText),
          dto.mimeType.toLowerCase(),
          dto.byteSize,
          expiresAt,
          JSON.stringify({ anonymousUploadGrantId: grantId })
        ]
      );
      await manager.query(
        `INSERT INTO anonymous_upload_grants (
          id, identity_project_id, identity_version_id, brand_asset_id, secret_hash,
          request_ip_hash, declared_byte_size, expires_at, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb)`,
        [grantId, project.id, identityVersionId, assetId, secretHash, this.hashIp(requesterIp), dto.byteSize, expiresAt]
      );
    });

    const token = this.signer.sign({ assetId, objectKey, purpose: 'upload', expiresAt: expiresAt.toISOString() });
    const baseUrl = this.config.getOrThrow<string>('API_PUBLIC_URL').replace(/\/$/, '');

    return {
      grantId,
      secret,
      assetId,
      upload: {
        method: 'PUT',
        uploadUrl: `${baseUrl}/v1/asset-upload-objects/${assetId}?token=${encodeURIComponent(token)}`,
        expiresAt: expiresAt.toISOString()
      }
    };
  }

  async completeAnonymousUpload(publicSlug: string, dto: CompleteAnonymousUploadDto) {
    const project = await this.findPublicProject(publicSlug);
    const { grant, asset } = await this.readAnonymousGrant(project.id, dto.grantId, dto.secret, true);

    if (![AnonymousUploadGrantStatus.Issued, AnonymousUploadGrantStatus.Uploaded].includes(grant.status)) {
      throw new DomainError('ANONYMOUS_GRANT_USED', 'Anonymous upload grant cannot be reused.', 409);
    }
    if (new Date(grant.expires_at).getTime() <= Date.now()) {
      await this.expireGrant(grant.id);
      throw new DomainError('ANONYMOUS_GRANT_EXPIRED', 'Anonymous upload grant has expired.', 410);
    }

    const object = await this.storage.readObject(asset.object_key);
    const actualByteSize = object.byteLength;
    const actualChecksum = createHash('sha256').update(object).digest('hex');
    const detectedMimeType = detectMimeType(object);

    if (actualByteSize !== Number(grant.declared_byte_size) || (dto.byteSize && dto.byteSize !== actualByteSize)) {
      await this.reject(asset.id, 'Anonymous uploaded object size does not match the declared size.');
      throw new DomainError('ANONYMOUS_ASSET_SIZE_MISMATCH', 'Uploaded object size does not match the declared size.', 422);
    }
    if (dto.checksumSha256 && dto.checksumSha256 !== actualChecksum) {
      await this.reject(asset.id, 'Anonymous uploaded object checksum does not match the completion checksum.');
      throw new DomainError('ANONYMOUS_ASSET_CHECKSUM_MISMATCH', 'Uploaded object checksum does not match the completion checksum.', 422);
    }
    if (!mimeMatchesDeclared(asset.declared_mime_type, detectedMimeType)) {
      await this.reject(asset.id, 'Anonymous uploaded object MIME signature does not match the declared MIME type.');
      throw new DomainError('ANONYMOUS_ASSET_MIME_MISMATCH', 'Uploaded object MIME signature does not match the declared MIME type.', 422);
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE brand_assets
         SET status = 'QUARANTINED', scan_status = 'PENDING', actual_byte_size = $2, detected_mime_type = $3,
             checksum_sha256 = $4, uploaded_at = COALESCE(uploaded_at, now()), updated_at = now(), lock_version = lock_version + 1
         WHERE id = $1`,
        [asset.id, actualByteSize, detectedMimeType, actualChecksum]
      );
      await manager.query(
        `UPDATE anonymous_upload_grants SET status = 'COMPLETED', used_at = now(), updated_at = now() WHERE id = $1`,
        [grant.id]
      );
    });
    await this.queue.enqueue(asset.id);

    return {
      grantId: grant.id,
      assetId: asset.id,
      status: 'QUARANTINED',
      scanStatus: 'PENDING'
    };
  }

  async getAnonymousUploadStatus(publicSlug: string, grantId: string, secret: string) {
    const project = await this.findPublicProject(publicSlug);
    const { grant, asset } = await this.readAnonymousGrant(project.id, grantId, secret, false);

    return {
      grantId: grant.id,
      assetId: asset.id,
      grantStatus: grant.status,
      assetStatus: limitedAssetStatus(asset.status),
      scanStatus: asset.scan_status,
      rejectionReason: asset.status === BrandAssetStatus.Rejected ? asset.rejection_reason : null
    };
  }

  async listPublicAssets(publicSlug: string) {
    const project = await this.findPublicProject(publicSlug);
    return this.dataSource.query(
      `SELECT id, category, display_name, alt_text, detected_mime_type, width, height,
              public_cdn_url, public_published_at, metadata
       FROM brand_assets
       WHERE identity_project_id = $1 AND visibility = 'PUBLIC_CDN' AND status = 'AVAILABLE'
         AND public_published_at IS NOT NULL AND public_unpublished_at IS NULL
       ORDER BY public_published_at DESC, id DESC`,
      [project.id]
    );
  }

  async publish(workspaceId: string, projectId: string, versionId: string, assetId: string, userId: string, dto: PublishAssetDto) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const rows = await this.dataSource.query<AssetRow[]>(
      `SELECT * FROM brand_assets
       WHERE id = $1 AND workspace_id = $2 AND identity_project_id = $3 AND identity_version_id = $4
         AND status = 'AVAILABLE' AND lock_version = $5
       FOR UPDATE`,
      [assetId, workspaceId, projectId, versionId, dto.lockVersion]
    );
    const asset = rows[0];
    if (!asset) throw new DomainError('ASSET_PUBLISH_CONFLICT', 'Asset was changed or is not available for publication.', 409);

    const projectRows = await this.dataSource.query<{ public_asset_slug: string | null }[]>(
      `SELECT public_asset_slug FROM identity_projects WHERE id = $1 AND workspace_id = $2`,
      [projectId, workspaceId]
    );
    const publicSlug = projectRows[0]?.public_asset_slug;
    if (!publicSlug) throw new DomainError('PUBLIC_ASSET_SLUG_REQUIRED', 'Set a public asset slug before publishing assets.', 409);

    const checksum = asset.checksum_sha256 ?? randomUUID().replace(/-/g, '');
    const cdnKey = `public/${publicSlug}/${assetId}-${checksum.slice(0, 12)}-${sanitizeFilename(asset.original_filename)}`;
    await this.storage.copyObject(asset.object_key, cdnKey);
    const publicCdnUrl = `${this.config.getOrThrow<string>('PUBLIC_ASSET_CDN_URL').replace(/\/$/, '')}/${cdnKey}`;

    const updated = await this.dataSource.query(
      `UPDATE brand_assets
       SET visibility = 'PUBLIC_CDN', public_cdn_key = $6, public_cdn_url = $7, published_by_user_id = $8,
           public_published_at = COALESCE(public_published_at, now()), public_unpublished_at = NULL,
           updated_at = now(), lock_version = lock_version + 1
       WHERE id = $1 AND workspace_id = $2 AND identity_project_id = $3 AND identity_version_id = $4 AND lock_version = $5
       RETURNING *`,
      [assetId, workspaceId, projectId, versionId, dto.lockVersion, cdnKey, publicCdnUrl, userId]
    );

    return updated[0];
  }

  async unpublish(workspaceId: string, projectId: string, versionId: string, assetId: string, dto: PublishAssetDto) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const rows = await this.dataSource.query(
      `UPDATE brand_assets
       SET visibility = 'PRIVATE', public_unpublished_at = now(), updated_at = now(), lock_version = lock_version + 1
       WHERE id = $1 AND workspace_id = $2 AND identity_project_id = $3 AND identity_version_id = $4
         AND lock_version = $5 AND visibility = 'PUBLIC_CDN'
       RETURNING *`,
      [assetId, workspaceId, projectId, versionId, dto.lockVersion]
    );
    if (!rows[0]) throw new DomainError('ASSET_UNPUBLISH_CONFLICT', 'Asset was changed or is not published.', 409);
    return rows[0];
  }

  async getDownloadGrant(workspaceId: string, projectId: string, versionId: string, assetId: string, variantId?: string) {
    const aggregate = await this.readAggregate(assetId, workspaceId, projectId, versionId);
    if (aggregate.asset.status !== BrandAssetStatus.Available) {
      throw new DomainError('ASSET_NOT_AVAILABLE', 'Asset is not available for download yet.', 409);
    }

    const variant = variantId ? aggregate.variants.find((item: { id: string }) => item.id === variantId) : null;
    const objectKey = variant?.object_key ?? aggregate.asset.object_key;
    const ttlSeconds = this.config.get<number>('ASSET_DOWNLOAD_GRANT_TTL_SECONDS') ?? 300;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const token = this.signer.sign({
      assetId,
      ...(variantId ? { variantId } : {}),
      objectKey,
      purpose: 'download',
      expiresAt: expiresAt.toISOString()
    });
    const baseUrl = this.config.getOrThrow<string>('API_PUBLIC_URL').replace(/\/$/, '');

    return {
      downloadUrl: `${baseUrl}/v1/asset-download-objects/${assetId}?token=${encodeURIComponent(token)}`,
      expiresAt: expiresAt.toISOString()
    };
  }

  async resolveUploadToken(assetId: string, token: string) {
    const payload = this.signer.verify(token, 'upload');
    if (payload.assetId !== assetId) throw new DomainError('ASSET_UPLOAD_TOKEN_INVALID', 'Upload token is invalid.', 403);

    const rows = await this.dataSource.query<AssetRow[]>(`SELECT * FROM brand_assets WHERE id = $1`, [assetId]);
    const asset = rows[0];
    if (!asset || asset.object_key !== payload.objectKey) {
      throw new DomainError('ASSET_UPLOAD_TOKEN_INVALID', 'Upload token is invalid.', 403);
    }
    if (asset.status !== BrandAssetStatus.PendingUpload) {
      throw new DomainError('ASSET_ALREADY_UPLOADED', 'Asset upload has already been completed.', 409);
    }
    if (asset.uploaded_at) {
      throw new DomainError('ASSET_UPLOAD_ALREADY_RECEIVED', 'Asset upload bytes were already received.', 409);
    }

    return asset;
  }

  async markUploadBytesReceived(assetId: string, byteSize: number, checksumSha256: string) {
    await this.dataSource.query(
      `UPDATE brand_assets
       SET actual_byte_size = $2, checksum_sha256 = COALESCE(checksum_sha256, $3), uploaded_at = now(), updated_at = now(),
           lock_version = lock_version + 1
       WHERE id = $1 AND uploaded_at IS NULL AND status = 'PENDING_UPLOAD'`,
      [assetId, byteSize, checksumSha256]
    );
    await this.dataSource.query(
      `UPDATE anonymous_upload_grants SET status = 'UPLOADED', updated_at = now()
       WHERE brand_asset_id = $1 AND status = 'ISSUED'`,
      [assetId]
    );
  }

  async resolveDownloadToken(assetId: string, token: string) {
    const payload = this.signer.verify(token, 'download');
    if (payload.assetId !== assetId) throw new DomainError('ASSET_DOWNLOAD_TOKEN_INVALID', 'Download token is invalid.', 403);

    const rows = await this.dataSource.query<AssetRow[]>(`SELECT * FROM brand_assets WHERE id = $1 AND status = 'AVAILABLE'`, [assetId]);
    const asset = rows[0];
    if (!asset) throw new DomainError('ASSET_NOT_FOUND', 'Asset was not found.', 404);
    return { asset, objectKey: payload.objectKey };
  }

  private buildUploadGrant(assetId: string, objectKey: string, expiresAt: Date) {
    const token = this.signer.sign({ assetId, objectKey, purpose: 'upload', expiresAt: expiresAt.toISOString() });
    const baseUrl = this.config.getOrThrow<string>('API_PUBLIC_URL').replace(/\/$/, '');
    return {
      method: 'PUT',
      uploadUrl: `${baseUrl}/v1/asset-upload-objects/${assetId}?token=${encodeURIComponent(token)}`,
      expiresAt: expiresAt.toISOString(),
      objectKey
    };
  }

  private async reject(assetId: string, reason: string) {
    await this.dataSource.query(
      `UPDATE brand_assets
       SET status = 'REJECTED', scan_status = 'FAILED', rejection_reason = $2, processed_at = now(), updated_at = now(), lock_version = lock_version + 1
       WHERE id = $1`,
      [assetId, reason]
    );
  }

  private async findPublicProject(publicSlug: string): Promise<PublicProjectRow> {
    const rows = await this.dataSource.query<PublicProjectRow[]>(
      `SELECT id, workspace_id, public_asset_slug, anonymous_uploads_enabled, active_version_id
       FROM identity_projects
       WHERE public_asset_slug = $1 AND status = 'ACTIVE'`,
      [publicSlug]
    );
    if (!rows[0]) throw new DomainError('PUBLIC_PROJECT_NOT_FOUND', 'Public project was not found.', 404);
    return rows[0];
  }

  private async findPublicUploadVersion(project: PublicProjectRow): Promise<string> {
    if (project.active_version_id) return project.active_version_id;

    const rows = await this.dataSource.query<{ id: string }[]>(
      `SELECT id FROM identity_versions WHERE identity_project_id = $1 AND status <> 'ARCHIVED' ORDER BY version_number DESC LIMIT 1`,
      [project.id]
    );
    if (!rows[0]) throw new DomainError('PUBLIC_PROJECT_VERSION_NOT_FOUND', 'Public project version was not found.', 404);
    return rows[0].id;
  }

  private async assertAnonymousQuota(projectId: string, requesterIp: string) {
    const ipHash = this.hashIp(requesterIp);
    const rows = await this.dataSource.query<{ ip_count: string; project_count: string }[]>(
      `SELECT
        (SELECT count(*) FROM anonymous_upload_grants WHERE request_ip_hash = $1 AND created_at > now() - interval '1 hour') AS ip_count,
        (SELECT count(*) FROM anonymous_upload_grants WHERE identity_project_id = $2 AND created_at > now() - interval '1 hour') AS project_count`,
      [ipHash, projectId]
    );
    if (Number(rows[0]?.ip_count ?? 0) >= 20 || Number(rows[0]?.project_count ?? 0) >= 200) {
      throw new DomainError('ANONYMOUS_UPLOAD_RATE_LIMITED', 'Anonymous upload quota exceeded.', 429);
    }
  }

  private async readAnonymousGrant(projectId: string, grantId: string, secret: string, forUpdate: boolean) {
    const rows = await this.dataSource.query<AnonymousGrantRow[]>(
      `SELECT * FROM anonymous_upload_grants WHERE id = $1 AND identity_project_id = $2 ${forUpdate ? 'FOR UPDATE' : ''}`,
      [grantId, projectId]
    );
    const grant = rows[0];
    if (!grant || grant.secret_hash !== this.hashSecret(secret)) {
      throw new DomainError('ANONYMOUS_GRANT_NOT_FOUND', 'Anonymous upload grant was not found.', 404);
    }
    const assetRows = await this.dataSource.query<(AssetRow & { scan_status: string; rejection_reason: string | null })[]>(
      `SELECT * FROM brand_assets WHERE id = $1 AND identity_project_id = $2`,
      [grant.brand_asset_id, projectId]
    );
    const asset = assetRows[0];
    if (!asset) throw new DomainError('ANONYMOUS_ASSET_NOT_FOUND', 'Anonymous uploaded asset was not found.', 404);
    return { grant, asset };
  }

  private async expireGrant(grantId: string) {
    await this.dataSource.query(`UPDATE anonymous_upload_grants SET status = 'EXPIRED', updated_at = now() WHERE id = $1`, [grantId]);
  }

  private assertBotChallenge(botChallenge: string) {
    if (botChallenge !== 'brand-identity-upload') {
      throw new DomainError('ANONYMOUS_UPLOAD_BOT_CHECK_FAILED', 'Anonymous upload bot challenge failed.', 403);
    }
  }

  private hashSecret(secret: string): string {
    return createHash('sha256')
      .update(`${secret}:${this.config.getOrThrow<string>('TOKEN_HASH_PEPPER')}`)
      .digest('hex');
  }

  private hashIp(ip: string): string {
    return createHash('sha256')
      .update(`${ip}:${this.config.getOrThrow<string>('TOKEN_HASH_PEPPER')}`)
      .digest('hex');
  }

  private async readAggregate(assetId: string, workspaceId: string, projectId: string, versionId: string) {
    const [assets, variants] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM brand_assets
         WHERE id = $1 AND workspace_id = $2 AND identity_project_id = $3 AND identity_version_id = $4 AND status <> 'ARCHIVED'`,
        [assetId, workspaceId, projectId, versionId]
      ),
      this.dataSource.query(`SELECT * FROM asset_variants WHERE brand_asset_id = $1 ORDER BY kind ASC, id ASC`, [assetId])
    ]);

    if (!assets[0]) throw new DomainError('ASSET_NOT_FOUND', 'Asset was not found.', 404);
    return { asset: assets[0], variants };
  }

  private async assertVersionAccess(workspaceId: string, projectId: string, versionId: string) {
    const rows = await this.dataSource.query(
      `SELECT identity_versions.id
       FROM identity_versions
       JOIN identity_projects ON identity_projects.id = identity_versions.identity_project_id
       WHERE identity_versions.id = $1 AND identity_projects.id = $2 AND identity_projects.workspace_id = $3 AND identity_projects.status = 'ACTIVE'`,
      [versionId, projectId, workspaceId]
    );
    if (!rows[0]) throw new DomainError('IDENTITY_VERSION_NOT_FOUND', 'Identity version was not found.', 404);
  }

  private async assertAssetsUnlocked(versionId: string) {
    const rows = await this.dataSource.query(`SELECT status FROM workflow_stages WHERE identity_version_id = $1 AND stage_key = 'ASSETS'`, [
      versionId
    ]);
    if (rows[0]?.status === WorkflowStageStatus.Locked) {
      throw new DomainError('ASSETS_STAGE_LOCKED', 'Select a visual direction before uploading assets.', 409);
    }
  }

  private async assertVisualDirectionBelongsToVersion(visualDirectionId: string, versionId: string) {
    const rows = await this.dataSource.query(`SELECT id FROM visual_directions WHERE id = $1 AND identity_version_id = $2 AND status = 'ACTIVE'`, [
      visualDirectionId,
      versionId
    ]);
    if (!rows[0]) throw new DomainError('VISUAL_DIRECTION_NOT_FOUND', 'Visual direction was not found.', 404);
  }

  private async markAssetStageGenerating(versionId: string) {
    await this.dataSource.query(
      `UPDATE workflow_stages
       SET status = 'GENERATING', updated_at = now()
       WHERE identity_version_id = $1 AND stage_key = $2 AND status IN ('NOT_STARTED', 'READY', 'STALE', 'FAILED')`,
      [versionId, WorkflowStageKey.Assets]
    );
  }
}

function sanitizeFilename(filename: string): string {
  const safe = filename
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 180);
  return safe || `${randomUUID()}.bin`;
}

function normalizeText(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function limitedAssetStatus(status: BrandAssetStatus): string {
  if ([BrandAssetStatus.PendingUpload, BrandAssetStatus.Quarantined, BrandAssetStatus.Processing].includes(status)) {
    return 'PROCESSING';
  }
  if (status === BrandAssetStatus.Available) {
    return 'AVAILABLE_FOR_REVIEW';
  }
  if (status === BrandAssetStatus.Rejected) {
    return 'REJECTED';
  }
  return 'UNAVAILABLE';
}
