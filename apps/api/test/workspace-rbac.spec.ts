import { describe, expect, it } from 'vitest';
import { WorkspaceRole } from '../src/database/entities';
import { roleCanAccess } from '../src/workspaces/workspace-rbac';

describe('roleCanAccess', () => {
  it.each([
    [WorkspaceRole.Owner, WorkspaceRole.Owner, true],
    [WorkspaceRole.Owner, WorkspaceRole.Viewer, true],
    [WorkspaceRole.Editor, WorkspaceRole.Reviewer, true],
    [WorkspaceRole.Reviewer, WorkspaceRole.Editor, false],
    [WorkspaceRole.Viewer, WorkspaceRole.Reviewer, false]
  ])('%s access to %s requirement is %s', (actual, required, expected) => {
    expect(roleCanAccess(actual, [required])).toBe(expected);
  });
});
