import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUserGuard } from '../auth/guards/current-user.guard';
import { WorkspaceRole } from '../database/entities';
import { RequireWorkspaceRole } from '../workspaces/decorators/workspace-roles.decorator';
import { WorkspaceMembershipGuard } from '../workspaces/guards/workspace-membership.guard';
import { DesignTokensService } from './design-tokens.service';

type TokenFormat = 'JSON' | 'CSS' | 'SCSS' | 'TAILWIND';

@ApiTags('design-tokens')
@UseGuards(CurrentUserGuard, WorkspaceMembershipGuard)
@Controller('workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/design-tokens')
export class DesignTokensController {
  constructor(private readonly tokens: DesignTokensService) {}

  @Post('compile')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  compile(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @Param('versionId') versionId: string) {
    return this.tokens.compile(workspaceId, projectId, versionId);
  }

  @Get()
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  listCurrent(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @Param('versionId') versionId: string) {
    return this.tokens.listCurrent(workspaceId, projectId, versionId);
  }

  @Get('current')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  getCurrent(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Query('format') format: TokenFormat = 'JSON'
  ) {
    return this.tokens.getCurrent(workspaceId, projectId, versionId, format);
  }
}
