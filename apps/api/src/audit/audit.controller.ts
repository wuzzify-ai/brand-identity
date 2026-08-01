import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUserGuard } from '../auth/guards/current-user.guard';
import { WorkspaceRole } from '../database/entities';
import { RequireWorkspaceRole } from '../workspaces/decorators/workspace-roles.decorator';
import { WorkspaceMembershipGuard } from '../workspaces/guards/workspace-membership.guard';
import { AuditService } from './audit.service';

@ApiTags('audit')
@UseGuards(CurrentUserGuard, WorkspaceMembershipGuard)
@Controller('workspaces/:workspaceId/brand-identities/:projectId/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequireWorkspaceRole(WorkspaceRole.Owner)
  list(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string, @Query('limit') limit?: string) {
    return this.audit.list(workspaceId, projectId, Number(limit ?? 50));
  }
}
