import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUserGuard } from '../auth/guards/current-user.guard';
import { WorkspaceRole } from '../database/entities';
import { RequireWorkspaceRole } from '../workspaces/decorators/workspace-roles.decorator';
import { WorkspaceMembershipGuard } from '../workspaces/guards/workspace-membership.guard';
import { UsageService } from './usage.service';

@ApiTags('usage')
@UseGuards(CurrentUserGuard, WorkspaceMembershipGuard)
@Controller('workspaces/:workspaceId/usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  @Get('ai/monthly')
  @RequireWorkspaceRole(WorkspaceRole.Owner)
  monthlyAiUsage(@Param('workspaceId') workspaceId: string) {
    return this.usage.monthlyAiUsage(workspaceId);
  }
}
