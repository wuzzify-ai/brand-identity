import { SetMetadata } from '@nestjs/common';
import type { WorkspaceRole } from '../../database/entities';

export const workspaceRolesMetadataKey = 'workspace:roles';

export function RequireWorkspaceRole(...roles: WorkspaceRole[]) {
  return SetMetadata(workspaceRolesMetadataKey, roles);
}
