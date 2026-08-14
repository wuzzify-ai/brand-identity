import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { CurrentUserGuard } from '../auth/guards/current-user.guard';
import { WorkspaceRole } from '../database/entities';
import { RequireWorkspaceRole } from '../workspaces/decorators/workspace-roles.decorator';
import { WorkspaceMembershipGuard } from '../workspaces/guards/workspace-membership.guard';
import {
  AutopilotRunEventDto,
  CloneIdentityVersionDto,
  CreateIdentityProjectDto,
  FinishAutopilotRunDto,
  UpdateIdentityProjectDto
} from './dto/identity-project.dto';
import { IdentityProjectsService } from './identity-projects.service';

@ApiTags('identity-projects')
@UseGuards(CurrentUserGuard, WorkspaceMembershipGuard)
@Controller('workspaces/:workspaceId/brand-identities')
export class IdentityProjectsController {
  constructor(private readonly projects: IdentityProjectsService) {}

  @Post()
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  create(@Param('workspaceId') workspaceId: string, @CurrentUserId() userId: string, @Body() body: CreateIdentityProjectDto) {
    return this.projects.create(workspaceId, userId, body);
  }

  @Get()
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  list(@Param('workspaceId') workspaceId: string, @Query() query: { status?: string; parentProjectId?: string; limit?: string; offset?: string }) {
    const listQuery: { status?: string; parentProjectId?: string; limit?: number; offset?: number } = {};

    if (query.status) {
      listQuery.status = query.status;
    }

    if (query.parentProjectId) {
      listQuery.parentProjectId = query.parentProjectId;
    }

    if (query.limit) {
      listQuery.limit = Number(query.limit);
    }

    if (query.offset) {
      listQuery.offset = Number(query.offset);
    }

    return this.projects.list(workspaceId, listQuery);
  }

  @Get(':projectId')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  get(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string) {
    return this.projects.get(workspaceId, projectId);
  }

  @Patch(':projectId')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  update(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @Body() body: UpdateIdentityProjectDto) {
    return this.projects.update(workspaceId, projectId, body);
  }

  @Delete(':projectId')
  @RequireWorkspaceRole(WorkspaceRole.Owner)
  archive(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @Query('lockVersion') lockVersion: string) {
    return this.projects.archive(workspaceId, projectId, Number(lockVersion));
  }

  @Get(':projectId/versions')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  versions(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string) {
    return this.projects.versions(workspaceId, projectId);
  }

  @Get(':projectId/versions/:versionId/activity')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  activity(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string
  ) {
    return this.projects.activity(workspaceId, projectId, versionId);
  }

  @Get(':projectId/versions/:versionId/handoffs')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  handoffs(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string
  ) {
    return this.projects.handoffs(workspaceId, projectId, versionId);
  }

  @Get(':projectId/versions/:versionId/readiness')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  readiness(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string
  ) {
    return this.projects.readiness(workspaceId, projectId, versionId);
  }

  @Get(':projectId/versions/:versionId/autopilot/current')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  currentAutopilot(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string
  ) {
    return this.projects.currentAutopilot(workspaceId, projectId, versionId);
  }

  @Get(':projectId/versions/:versionId/autopilot/history')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  autopilotHistory(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Query('limit') limit?: string
  ) {
    return this.projects.autopilotHistory(workspaceId, projectId, versionId, limit ? Number(limit) : undefined);
  }

  @Post(':projectId/versions/:versionId/autopilot/start')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  startAutopilot(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @CurrentUserId() userId: string
  ) {
    return this.projects.startAutopilot(workspaceId, projectId, versionId, userId);
  }

  @Post(':projectId/versions/:versionId/autopilot/advance')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  advanceAutopilot(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @CurrentUserId() userId: string
  ) {
    return this.projects.advanceAutopilot(workspaceId, projectId, versionId, userId);
  }

  @Post(':projectId/versions/:versionId/autopilot/runs/:runId/events')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  appendAutopilotEvent(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('runId') runId: string,
    @Body() body: AutopilotRunEventDto
  ) {
    return this.projects.appendAutopilotEvent(workspaceId, projectId, versionId, runId, body);
  }

  @Post(':projectId/versions/:versionId/autopilot/runs/:runId/pause')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  pauseAutopilot(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('runId') runId: string,
    @Body() body: FinishAutopilotRunDto
  ) {
    return this.projects.pauseAutopilot(workspaceId, projectId, versionId, runId, body.reason ?? 'Human review is required.');
  }

  @Post(':projectId/versions/:versionId/autopilot/runs/:runId/complete')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  completeAutopilot(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('runId') runId: string,
    @Body() body: FinishAutopilotRunDto
  ) {
    return this.projects.completeAutopilot(workspaceId, projectId, versionId, runId, body.reason ?? 'Autopilot completed.');
  }

  @Post(':projectId/versions/:versionId/autopilot/runs/:runId/fail')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  failAutopilot(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('runId') runId: string,
    @Body() body: FinishAutopilotRunDto
  ) {
    return this.projects.failAutopilot(workspaceId, projectId, versionId, runId, body.errorMessage ?? body.reason ?? 'Autopilot failed.');
  }

  @Post(':projectId/versions/:versionId/autopilot/runs/:runId/cancel')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  cancelAutopilot(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('runId') runId: string,
    @Body() body: FinishAutopilotRunDto
  ) {
    return this.projects.cancelAutopilot(workspaceId, projectId, versionId, runId, body.reason ?? 'Autopilot cancelled by user.');
  }

  @Post(':projectId/versions/:versionId/autopilot/runs/:runId/retry')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  retryAutopilot(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('runId') runId: string,
    @CurrentUserId() userId: string
  ) {
    return this.projects.retryAutopilot(workspaceId, projectId, versionId, runId, userId);
  }

  @Post(':projectId/versions/clone')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  clone(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @CurrentUserId() userId: string, @Body() body: CloneIdentityVersionDto) {
    return this.projects.cloneDraft(workspaceId, projectId, userId, body);
  }
}
