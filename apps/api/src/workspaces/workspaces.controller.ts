import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { CurrentUserGuard } from '../auth/guards/current-user.guard';
import { WorkspaceRole } from '../database/entities';
import { RequireWorkspaceRole } from './decorators/workspace-roles.decorator';
import {
  AcceptWorkspaceInvitationDto,
  CreateWorkspaceDto,
  InviteWorkspaceMemberDto,
  UpdateWorkspaceDto,
  UpdateWorkspaceMemberDto
} from './dto/workspace.dto';
import { WorkspaceMembershipGuard } from './guards/workspace-membership.guard';
import { WorkspacesService } from './workspaces.service';

@ApiTags('workspaces')
@UseGuards(CurrentUserGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  create(@CurrentUserId() userId: string, @Body() body: CreateWorkspaceDto) {
    return this.workspaces.createWorkspace(userId, body);
  }

  @Get()
  list(@CurrentUserId() userId: string) {
    return this.workspaces.listWorkspaces(userId);
  }

  @Post('invitations/accept')
  acceptInvitation(@CurrentUserId() userId: string, @Body() body: AcceptWorkspaceInvitationDto) {
    return this.workspaces.acceptInvitation(userId, body.token);
  }

  @Get(':workspaceId')
  @UseGuards(WorkspaceMembershipGuard)
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  get(@Param('workspaceId') workspaceId: string) {
    return this.workspaces.getWorkspace(workspaceId);
  }

  @Patch(':workspaceId')
  @UseGuards(WorkspaceMembershipGuard)
  @RequireWorkspaceRole(WorkspaceRole.Owner)
  update(@Param('workspaceId') workspaceId: string, @Body() body: UpdateWorkspaceDto) {
    return this.workspaces.updateWorkspace(workspaceId, body);
  }

  @Delete(':workspaceId')
  @UseGuards(WorkspaceMembershipGuard)
  @RequireWorkspaceRole(WorkspaceRole.Owner)
  archive(@Param('workspaceId') workspaceId: string, @Query('lockVersion') lockVersion: string) {
    return this.workspaces.archiveWorkspace(workspaceId, Number(lockVersion));
  }

  @Get(':workspaceId/members')
  @UseGuards(WorkspaceMembershipGuard)
  @RequireWorkspaceRole(WorkspaceRole.Viewer)
  members(@Param('workspaceId') workspaceId: string) {
    return this.workspaces.listMembers(workspaceId);
  }

  @Patch(':workspaceId/members/:userId')
  @UseGuards(WorkspaceMembershipGuard)
  @RequireWorkspaceRole(WorkspaceRole.Owner)
  updateMember(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() body: UpdateWorkspaceMemberDto
  ) {
    return this.workspaces.updateMember(workspaceId, userId, body);
  }

  @Delete(':workspaceId/members/:userId')
  @UseGuards(WorkspaceMembershipGuard)
  @RequireWorkspaceRole(WorkspaceRole.Owner)
  removeMember(@Param('workspaceId') workspaceId: string, @Param('userId') userId: string) {
    return this.workspaces.removeMember(workspaceId, userId);
  }

  @Post(':workspaceId/invitations')
  @UseGuards(WorkspaceMembershipGuard)
  @RequireWorkspaceRole(WorkspaceRole.Owner)
  invite(
    @CurrentUserId() userId: string,
    @Param('workspaceId') workspaceId: string,
    @Body() body: InviteWorkspaceMemberDto
  ) {
    return this.workspaces.inviteMember(workspaceId, userId, body);
  }

  @Get(':workspaceId/invitations')
  @UseGuards(WorkspaceMembershipGuard)
  @RequireWorkspaceRole(WorkspaceRole.Owner)
  invitations(@Param('workspaceId') workspaceId: string) {
    return this.workspaces.listInvitations(workspaceId);
  }

  @Delete(':workspaceId/invitations/:invitationId')
  @UseGuards(WorkspaceMembershipGuard)
  @RequireWorkspaceRole(WorkspaceRole.Owner)
  revokeInvitation(@Param('workspaceId') workspaceId: string, @Param('invitationId') invitationId: string) {
    return this.workspaces.revokeInvitation(workspaceId, invitationId);
  }
}
