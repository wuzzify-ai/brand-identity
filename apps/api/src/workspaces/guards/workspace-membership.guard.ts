import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { WorkspaceRole } from '../../database/entities';
import { workspaceRolesMetadataKey } from '../decorators/workspace-roles.decorator';
import { roleCanAccess } from '../workspace-rbac';
import { WorkspacesService } from '../workspaces.service';

@Injectable()
export class WorkspaceMembershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly workspaces: WorkspacesService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawWorkspaceId = request.params.workspaceId;
    const workspaceId = Array.isArray(rawWorkspaceId) ? rawWorkspaceId[0] : rawWorkspaceId;
    const userId = request.currentUserId;

    if (!workspaceId || !userId) {
      throw new NotFoundException('Workspace was not found.');
    }

    const allowedRoles =
      this.reflector.getAllAndOverride<WorkspaceRole[]>(workspaceRolesMetadataKey, [
        context.getHandler(),
        context.getClass()
      ]) ?? [WorkspaceRole.Viewer];

    const membership = await this.workspaces.findActiveMembership(workspaceId, userId);

    if (!membership) {
      throw new NotFoundException('Workspace was not found.');
    }

    if (!roleCanAccess(membership.role, allowedRoles)) {
      throw new ForbiddenException('Workspace role is not allowed.');
    }

    request.workspaceId = workspaceId;
    request.workspaceRole = membership.role;
    return true;
  }
}
