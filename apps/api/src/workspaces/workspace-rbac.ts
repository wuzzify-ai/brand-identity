import { WorkspaceRole } from '../database/entities';

export const workspaceRoleRank: Record<WorkspaceRole, number> = {
  [WorkspaceRole.Owner]: 4,
  [WorkspaceRole.Editor]: 3,
  [WorkspaceRole.Reviewer]: 2,
  [WorkspaceRole.Viewer]: 1
};

export function roleCanAccess(actual: WorkspaceRole, allowed: WorkspaceRole[]): boolean {
  return allowed.some((role) => workspaceRoleRank[actual] >= workspaceRoleRank[role]);
}
