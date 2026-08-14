import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUserGuard } from '../auth/guards/current-user.guard';
import { WorkspaceRole } from '../database/entities';
import { RequireWorkspaceRole } from '../workspaces/decorators/workspace-roles.decorator';
import { WorkspaceMembershipGuard } from '../workspaces/guards/workspace-membership.guard';
import { BrandContextService } from './brand-context.service';
import { BrandContextValidationDto } from './dto/brand-context-validation.dto';

@ApiTags('brand-context')
@UseGuards(CurrentUserGuard, WorkspaceMembershipGuard)
@Controller('workspaces/:workspaceId/brand-identities/:projectId/brand-context')
export class BrandContextController {
  constructor(private readonly brandContext: BrandContextService) {}

  @Get('current')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  current(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string) {
    return this.brandContext.current(workspaceId, projectId);
  }

  @Get('packages')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  list(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string) {
    return this.brandContext.list(workspaceId, projectId);
  }

  @Get('packages/:packageId')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  get(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @Param('packageId') packageId: string) {
    return this.brandContext.get(workspaceId, projectId, packageId);
  }

  @Post('versions/:versionId/compile')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  compile(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @Param('versionId') versionId: string) {
    return this.brandContext.compile(workspaceId, projectId, versionId);
  }

  @Post('current/validate')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  validateCurrent(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @Body() body: BrandContextValidationDto) {
    return this.brandContext.validateCurrent(workspaceId, projectId, body);
  }

  @Post('packages/:packageId/validate')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  validatePackage(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('packageId') packageId: string,
    @Body() body: BrandContextValidationDto
  ) {
    return this.brandContext.validatePackage(workspaceId, projectId, packageId, body);
  }
}
