import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUserGuard } from '../auth/guards/current-user.guard';
import { WorkspaceRole } from '../database/entities';
import { RequireWorkspaceRole } from '../workspaces/decorators/workspace-roles.decorator';
import { WorkspaceMembershipGuard } from '../workspaces/guards/workspace-membership.guard';
import { CreateVisualDirectionDto, SelectVisualDirectionDto, UpdateVisualDirectionDto } from './dto/visual-direction.dto';
import { VisualDirectionsService } from './visual-directions.service';

@ApiTags('visual-directions')
@UseGuards(CurrentUserGuard, WorkspaceMembershipGuard)
@Controller('workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/visual-directions')
export class VisualDirectionsController {
  constructor(private readonly directions: VisualDirectionsService) {}

  @Get()
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  list(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @Param('versionId') versionId: string) {
    return this.directions.list(workspaceId, projectId, versionId);
  }

  @Post()
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  create(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @Body() body: CreateVisualDirectionDto) {
    return this.directions.create(workspaceId, projectId, body);
  }

  @Get(':directionId')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  get(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('directionId') directionId: string
  ) {
    return this.directions.get(workspaceId, projectId, versionId, directionId);
  }

  @Put(':directionId')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('directionId') directionId: string,
    @Body() body: UpdateVisualDirectionDto
  ) {
    return this.directions.update(workspaceId, projectId, versionId, directionId, body);
  }

  @Post(':directionId/select')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  select(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('directionId') directionId: string,
    @Body() body: SelectVisualDirectionDto
  ) {
    return this.directions.select(workspaceId, projectId, versionId, directionId, body);
  }

  @Delete(':directionId')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  archive(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('directionId') directionId: string,
    @Query('lockVersion') lockVersion: string
  ) {
    return this.directions.archive(workspaceId, projectId, versionId, directionId, Number(lockVersion));
  }
}
