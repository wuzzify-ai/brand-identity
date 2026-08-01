import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUserGuard } from '../auth/guards/current-user.guard';
import { WorkspaceRole } from '../database/entities';
import { RequireWorkspaceRole } from '../workspaces/decorators/workspace-roles.decorator';
import { WorkspaceMembershipGuard } from '../workspaces/guards/workspace-membership.guard';
import { LogoConceptActionDto, UpdateLogoConceptDto } from './dto/logo-concept.dto';
import { LogoConceptsService } from './logo-concepts.service';

@ApiTags('logo-concepts')
@UseGuards(CurrentUserGuard, WorkspaceMembershipGuard)
@Controller('workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/logo-concepts')
export class LogoConceptsController {
  constructor(private readonly concepts: LogoConceptsService) {}

  @Get()
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  list(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @Param('versionId') versionId: string) {
    return this.concepts.list(workspaceId, projectId, versionId);
  }

  @Get(':conceptId')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  get(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('conceptId') conceptId: string
  ) {
    return this.concepts.get(workspaceId, projectId, versionId, conceptId);
  }

  @Patch(':conceptId')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('conceptId') conceptId: string,
    @Body() body: UpdateLogoConceptDto
  ) {
    return this.concepts.update(workspaceId, projectId, versionId, conceptId, body);
  }

  @Post(':conceptId/shortlist')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  shortlist(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('conceptId') conceptId: string,
    @Body() body: LogoConceptActionDto
  ) {
    return this.concepts.shortlist(workspaceId, projectId, versionId, conceptId, body);
  }

  @Post(':conceptId/select')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  select(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('conceptId') conceptId: string,
    @Body() body: LogoConceptActionDto
  ) {
    return this.concepts.select(workspaceId, projectId, versionId, conceptId, body);
  }

  @Post(':conceptId/reject')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  reject(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('conceptId') conceptId: string,
    @Body() body: LogoConceptActionDto
  ) {
    return this.concepts.reject(workspaceId, projectId, versionId, conceptId, body);
  }

  @Delete(':conceptId')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  archive(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('conceptId') conceptId: string,
    @Query('lockVersion') lockVersion: string
  ) {
    return this.concepts.archive(workspaceId, projectId, versionId, conceptId, Number(lockVersion));
  }
}
