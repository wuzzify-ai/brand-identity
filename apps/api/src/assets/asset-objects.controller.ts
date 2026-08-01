import { Controller, Get, Param, Put, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { DomainError } from '../common/domain-error';
import { AssetsService } from './assets.service';
import { PrivateAssetStorage } from './storage/private-asset-storage.service';

@ApiTags('asset-objects')
@Controller()
export class AssetObjectsController {
  constructor(
    private readonly assets: AssetsService,
    private readonly storage: PrivateAssetStorage
  ) {}

  @Put('asset-upload-objects/:assetId')
  async upload(@Param('assetId') assetId: string, @Query('token') token: string, @Req() request: Request) {
    if (!token) throw new DomainError('ASSET_UPLOAD_TOKEN_REQUIRED', 'Upload token is required.', 401);

    const asset = await this.assets.resolveUploadToken(assetId, token);
    const maxBytes = Number(asset.declared_byte_size);
    const stored = await this.storage.putRequestBody(asset.object_key, request, maxBytes);
    await this.assets.markUploadBytesReceived(asset.id, stored.byteSize, stored.checksumSha256);

    return { ok: true, byteSize: stored.byteSize, checksumSha256: stored.checksumSha256 };
  }

  @Get('asset-download-objects/:assetId')
  async download(@Param('assetId') assetId: string, @Query('token') token: string, @Res() response: Response) {
    if (!token) throw new DomainError('ASSET_DOWNLOAD_TOKEN_REQUIRED', 'Download token is required.', 401);

    const { asset, objectKey } = await this.assets.resolveDownloadToken(assetId, token);
    this.storage.streamObject(objectKey, response, asset.detected_mime_type ?? asset.declared_mime_type, asset.original_filename);
  }
}
