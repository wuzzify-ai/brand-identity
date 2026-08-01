import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { CurrentUserGuard } from '../auth/guards/current-user.guard';
import { WorkspaceRole } from '../database/entities';
import { RequireWorkspaceRole } from '../workspaces/decorators/workspace-roles.decorator';
import { WorkspaceMembershipGuard } from '../workspaces/guards/workspace-membership.guard';
import { CompleteStrategyDto, UpdateStrategyDto } from './dto/strategy.dto';
import { StrategiesService } from './strategies.service';

@ApiTags('strategies')
@UseGuards(CurrentUserGuard, WorkspaceMembershipGuard)
@Controller('workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/strategy')
export class StrategiesController {
  constructor(private readonly strategies: StrategiesService) {}

  @Get()
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  get(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @Param('versionId') versionId: string) {
    return this.strategies.get(workspaceId, projectId, versionId);
  }

  @Put()
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Body() body: UpdateStrategyDto
  ) {
    return this.strategies.update(workspaceId, projectId, versionId, body);
  }

  @Post('complete')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  complete(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @CurrentUserId() userId: string,
    @Body() body: CompleteStrategyDto
  ) {
    return this.strategies.complete(workspaceId, projectId, versionId, userId, body);
  }
}
