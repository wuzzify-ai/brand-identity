import { Body, Controller, Get, Param, Put, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { CurrentUserGuard } from '../auth/guards/current-user.guard';
import { WorkspaceRole } from '../database/entities';
import { RequireWorkspaceRole } from '../workspaces/decorators/workspace-roles.decorator';
import { WorkspaceMembershipGuard } from '../workspaces/guards/workspace-membership.guard';
import { BriefsService } from './briefs.service';
import { CompleteBriefDto, UpdateBriefDto } from './dto/brief.dto';

@ApiTags('briefs')
@UseGuards(CurrentUserGuard, WorkspaceMembershipGuard)
@Controller('workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/brief')
export class BriefsController {
  constructor(private readonly briefs: BriefsService) {}

  @Get()
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  get(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string
  ) {
    return this.briefs.get(workspaceId, projectId, versionId);
  }

  @Put()
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Body() body: UpdateBriefDto
  ) {
    return this.briefs.update(workspaceId, projectId, versionId, body);
  }

  @Post('complete')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  complete(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @CurrentUserId() userId: string,
    @Body() body: CompleteBriefDto
  ) {
    return this.briefs.complete(workspaceId, projectId, versionId, userId, body);
  }
}
