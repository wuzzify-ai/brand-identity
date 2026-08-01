import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUserGuard } from '../auth/guards/current-user.guard';
import { WorkspaceRole } from '../database/entities';
import { RequireWorkspaceRole } from '../workspaces/decorators/workspace-roles.decorator';
import { WorkspaceMembershipGuard } from '../workspaces/guards/workspace-membership.guard';
import { BrandBooksService } from './brand-books.service';

@ApiTags('brand-books')
@UseGuards(CurrentUserGuard, WorkspaceMembershipGuard)
@Controller('workspaces/:workspaceId/brand-identities/:projectId/versions/:versionId/brand-books')
export class BrandBooksController {
  constructor(private readonly brandBooks: BrandBooksService) {}

  @Post('generate')
  @RequireWorkspaceRole(WorkspaceRole.Editor)
  generate(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @Param('versionId') versionId: string) {
    return this.brandBooks.generate(workspaceId, projectId, versionId);
  }

  @Get()
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  list(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @Param('versionId') versionId: string) {
    return this.brandBooks.list(workspaceId, projectId, versionId);
  }

  @Get('current')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  current(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @Param('versionId') versionId: string) {
    return this.brandBooks.getCurrent(workspaceId, projectId, versionId);
  }

  @Get(':brandBookId')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  get(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('brandBookId') brandBookId: string
  ) {
    return this.brandBooks.get(workspaceId, projectId, versionId, brandBookId);
  }

  @Post('exports/:exportId/download-url')
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  downloadUrl(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('exportId') exportId: string
  ) {
    return this.brandBooks.getExportDownloadGrant(workspaceId, projectId, versionId, exportId);
  }
}
