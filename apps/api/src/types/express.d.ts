import type { WorkspaceRole } from '../database/entities';

declare global {
  namespace Express {
    export interface Request {
      requestId?: string;
      currentUserId?: string;
      currentSessionId?: string;
      workspaceId?: string;
      workspaceRole?: WorkspaceRole;
    }
  }
}

export {};
