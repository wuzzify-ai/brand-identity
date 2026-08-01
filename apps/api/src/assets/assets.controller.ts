import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { CurrentUserGuard } from '../auth/guards/current-user.guard';
import { WorkspaceRole } from '../database/entities';
import { RequireWorkspaceRole } from '../workspaces/decorators/workspace-roles.decorator';
import { WorkspaceMembershipGuard } from '../workspaces/guards/workspace-membership.guard';
import { AssetsService } from './assets.service';
import { CompleteAssetUploadDto, CreateAssetUploadDto, UpdateAssetDto } from './dto/asset.dto';
import { PublishAssetDto } from './dto/public-asset.dto';

@ApiTags('assets')
@UseGuards(CurrentUserGuard, WorkspaceMembershipGuard)
@Controller('workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Post('uploads')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  createUpload(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUserId() userId: string,
    @Body() body: CreateAssetUploadDto
  ) {
    return this.assets.createUpload(workspaceId, projectId, userId, body);
  }

  @Get()
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  list(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @Param('versionId') versionId: string) {
    return this.assets.list(workspaceId, projectId, versionId);
  }

  @Get(':assetId')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  get(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('assetId') assetId: string
  ) {
    return this.assets.get(workspaceId, projectId, versionId, assetId);
  }

  @Post(':assetId/complete')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  complete(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('assetId') assetId: string,
    @Body() body: CompleteAssetUploadDto
  ) {
    return this.assets.completeUpload(workspaceId, projectId, versionId, assetId, body);
  }

  @Patch(':assetId')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('assetId') assetId: string,
    @Body() body: UpdateAssetDto
  ) {
    return this.assets.update(workspaceId, projectId, versionId, assetId, body);
  }

  @Delete(':assetId')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  archive(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('assetId') assetId: string,
    @Query('lockVersion') lockVersion: string
  ) {
    return this.assets.archive(workspaceId, projectId, versionId, assetId, Number(lockVersion));
  }

  @Post(':assetId/download-url')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  downloadUrl(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('assetId') assetId: string,
    @Query('variantId') variantId?: string
  ) {
    return this.assets.getDownloadGrant(workspaceId, projectId, versionId, assetId, variantId);
  }

  @Post(':assetId/publish')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  publish(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('assetId') assetId: string,
    @CurrentUserId() userId: string,
    @Body() body: PublishAssetDto
  ) {
    return this.assets.publish(workspaceId, projectId, versionId, assetId, userId, body);
  }

  @Post(':assetId/unpublish')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  unpublish(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('assetId') assetId: string,
    @Body() body: PublishAssetDto
  ) {
    return this.assets.unpublish(workspaceId, projectId, versionId, assetId, body);
  }
}
