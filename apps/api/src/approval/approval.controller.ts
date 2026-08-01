import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { CurrentUserGuard } from '../auth/guards/current-user.guard';
import { WorkspaceRole } from '../database/entities';
import { RequireWorkspaceRole } from '../workspaces/decorators/workspace-roles.decorator';
import { WorkspaceMembershipGuard } from '../workspaces/guards/workspace-membership.guard';
import { ApprovalService } from './approval.service';
import { ApprovalReasonDto } from './dto/approval.dto';

@ApiTags('approval')
@UseGuards(CurrentUserGuard, WorkspaceMembershipGuard)
@Controller('workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/approval')
export class ApprovalController {
  constructor(private readonly approval: ApprovalService) {}

  @Get('history')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  history(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @Param('versionId') versionId: string) {
    return this.approval.history(workspaceId, projectId, versionId);
  }

  @Post('submit')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  submit(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @CurrentUserId() userId: string,
    @Body() body: ApprovalReasonDto
  ) {
    return this.approval.submit(workspaceId, projectId, versionId, userId, body);
  }

  @Post('approve')
  @RequireWorkspaceRole(WorkspaceRole.Reviewer)
  approve(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @CurrentUserId() userId: string,
    @Body() body: ApprovalReasonDto
  ) {
    return this.approval.approve(workspaceId, projectId, versionId, userId, body);
  }

  @Post('reject')
  @RequireWorkspaceRole(WorkspaceRole.Reviewer)
  reject(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @CurrentUserId() userId: string,
    @Body() body: ApprovalReasonDto
  ) {
    return this.approval.reject(workspaceId, projectId, versionId, userId, body);
  }

  @Post('activate')
  @RequireWorkspaceRole(WorkspaceRole.Owner)
  activate(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @CurrentUserId() userId: string,
    @Body() body: ApprovalReasonDto
  ) {
    return this.approval.activate(workspaceId, projectId, versionId, userId, body);
  }
}
