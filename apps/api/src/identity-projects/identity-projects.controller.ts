import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { CurrentUserGuard } from '../auth/guards/current-user.guard';
import { WorkspaceRole } from '../database/entities';
import { RequireWorkspaceRole } from '../workspaces/decorators/workspace-roles.decorator';
import { WorkspaceMembershipGuard } from '../workspaces/guards/workspace-membership.guard';
import { CloneIdentityVersionDto, CreateIdentityProjectDto, UpdateIdentityProjectDto } from './dto/identity-project.dto';
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

  @Post(':projectId/versions/clone')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  clone(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @CurrentUserId() userId: string, @Body() body: CloneIdentityVersionDto) {
    return this.projects.cloneDraft(workspaceId, projectId, userId, body);
  }
}
