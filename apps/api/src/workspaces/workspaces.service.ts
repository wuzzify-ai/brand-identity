import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { DomainError } from '../common/domain-error';
import { InvitationStatus, MembershipStatus, WorkspaceRole } from '../database/entities';
import { AuthEmailService } from '../auth/email/auth-email.service';
import { TokenHashService } from '../auth/token-hash.service';
import type {
  CreateWorkspaceDto,
  InviteWorkspaceMemberDto,
  UpdateWorkspaceDto,
  UpdateWorkspaceMemberDto
} from './dto/workspace.dto';

type MembershipRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  status: MembershipStatus;
};

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tokenHash: TokenHashService,
    private readonly email: AuthEmailService
  ) {}

  async findActiveMembership(workspaceId: string, userId: string): Promise<{ role: WorkspaceRole } | null> {
    const rows = await this.dataSource.query<MembershipRow[]>(
      `SELECT role
       FROM workspace_memberships
       WHERE workspace_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
      [workspaceId, userId]
    );

    return rows[0] ? { role: rows[0].role } : null;
  }

  async createWorkspace(userId: string, dto: CreateWorkspaceDto) {
    try {
      const rows = await this.dataSource.transaction(async (manager) => {
        const workspaceRows = await manager.query<{ id: string }[]>(
          `INSERT INTO workspaces (name, slug, created_by_user_id) VALUES ($1, $2, $3) RETURNING *`,
          [dto.name.trim(), dto.slug, userId]
        );
        const workspace = workspaceRows[0];

        await manager.query(
          `INSERT INTO workspace_memberships (workspace_id, user_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')`,
          [workspace?.id, userId]
        );

        return workspaceRows;
      });

      return rows[0];
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new DomainError('WORKSPACE_CONFLICT', 'Workspace slug already exists.', 409);
      }

      throw error;
    }
  }

  listWorkspaces(userId: string) {
    return this.dataSource.query(
      `SELECT workspaces.*, workspace_memberships.role
       FROM workspaces
       JOIN workspace_memberships ON workspace_memberships.workspace_id = workspaces.id
       WHERE workspace_memberships.user_id = $1
         AND workspace_memberships.status = 'ACTIVE'
         AND workspaces.status = 'ACTIVE'
       ORDER BY workspaces.created_at DESC`,
      [userId]
    );
  }

  async getWorkspace(workspaceId: string) {
    const rows = await this.dataSource.query(`SELECT * FROM workspaces WHERE id = $1 AND status = 'ACTIVE'`, [
      workspaceId
    ]);

    return rows[0];
  }

  async updateWorkspace(workspaceId: string, dto: UpdateWorkspaceDto) {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (dto.name !== undefined) {
      values.push(dto.name.trim());
      setClauses.push(`name = $${values.length}`);
    }

    if (dto.slug !== undefined) {
      values.push(dto.slug);
      setClauses.push(`slug = $${values.length}`);
    }

    if (setClauses.length === 0) {
      return this.getWorkspace(workspaceId);
    }

    values.push(dto.lockVersion);
    const lockVersionIndex = values.length;
    values.push(workspaceId);
    const workspaceIdIndex = values.length;

    try {
      const rows = await this.dataSource.query(
        `UPDATE workspaces
         SET ${setClauses.join(', ')}, updated_at = now(), lock_version = lock_version + 1
         WHERE lock_version = $${lockVersionIndex} AND id = $${workspaceIdIndex} AND status = 'ACTIVE'
         RETURNING *`,
        values
      );

      if (!rows[0]) {
        throw new DomainError('WORKSPACE_UPDATE_CONFLICT', 'Workspace was changed by another request.', 409);
      }

      return rows[0];
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new DomainError('WORKSPACE_CONFLICT', 'Workspace slug already exists.', 409);
      }

      throw error;
    }
  }

  async archiveWorkspace(workspaceId: string, lockVersion: number) {
    if (!Number.isInteger(lockVersion) || lockVersion < 1) {
      throw new DomainError('INVALID_LOCK_VERSION', 'A valid lockVersion is required.', 400);
    }

    const rows = await this.dataSource.query(
      `UPDATE workspaces
       SET status = 'ARCHIVED', archived_at = now(), updated_at = now(), lock_version = lock_version + 1
       WHERE id = $1 AND lock_version = $2 AND status = 'ACTIVE'
       RETURNING id`,
      [workspaceId, lockVersion]
    );

    if (!rows[0]) {
      throw new DomainError('WORKSPACE_UPDATE_CONFLICT', 'Workspace was changed by another request.', 409);
    }

    return { ok: true };
  }

  listMembers(workspaceId: string) {
    return this.dataSource.query(
      `SELECT workspace_memberships.id, workspace_memberships.user_id, workspace_memberships.role,
              workspace_memberships.status, workspace_memberships.joined_at, users.email, users.display_name
       FROM workspace_memberships
       JOIN users ON users.id = workspace_memberships.user_id
       WHERE workspace_memberships.workspace_id = $1
       ORDER BY workspace_memberships.joined_at ASC`,
      [workspaceId]
    );
  }

  async updateMember(workspaceId: string, targetUserId: string, dto: UpdateWorkspaceMemberDto) {
    return this.dataSource.transaction(async (manager) => {
      const currentRows = await manager.query<MembershipRow[]>(
        `SELECT id, role, status, workspace_id, user_id
         FROM workspace_memberships
         WHERE workspace_id = $1 AND user_id = $2
         FOR UPDATE`,
        [workspaceId, targetUserId]
      );
      const current = currentRows[0];

      if (!current) {
        throw new DomainError('MEMBERSHIP_NOT_FOUND', 'Membership was not found.', 404);
      }

      if (current.role === WorkspaceRole.Owner && dto.role !== WorkspaceRole.Owner) {
        await this.assertAnotherOwner(manager, workspaceId, targetUserId);
      }

      const rows = await manager.query(
        `UPDATE workspace_memberships SET role = $3, updated_at = now() WHERE workspace_id = $1 AND user_id = $2 RETURNING *`,
        [workspaceId, targetUserId, dto.role]
      );

      return rows[0];
    });
  }

  async removeMember(workspaceId: string, targetUserId: string) {
    await this.dataSource.transaction(async (manager) => {
      const currentRows = await manager.query<MembershipRow[]>(
        `SELECT id, role, status, workspace_id, user_id
         FROM workspace_memberships
         WHERE workspace_id = $1 AND user_id = $2
         FOR UPDATE`,
        [workspaceId, targetUserId]
      );
      const current = currentRows[0];

      if (!current) {
        throw new DomainError('MEMBERSHIP_NOT_FOUND', 'Membership was not found.', 404);
      }

      if (current.role === WorkspaceRole.Owner && current.status === MembershipStatus.Active) {
        await this.assertAnotherOwner(manager, workspaceId, targetUserId);
      }

      await manager.query(`DELETE FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2`, [
        workspaceId,
        targetUserId
      ]);
    });

    return { ok: true };
  }

  async inviteMember(workspaceId: string, invitedByUserId: string, dto: InviteWorkspaceMemberDto) {
    const rawToken = this.tokenHash.generateRawToken();
    const invitationHash = this.tokenHash.hash(rawToken);

    try {
      await this.dataSource.query(
        `INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, invited_by_user_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, now() + interval '7 days')`,
        [workspaceId, dto.email, dto.role, invitationHash, invitedByUserId]
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new DomainError('INVITATION_CONFLICT', 'A pending invitation already exists.', 409);
      }

      throw error;
    }

    await this.email.sendWorkspaceInvitationEmail(dto.email, rawToken);
    return { ok: true };
  }

  listInvitations(workspaceId: string) {
    return this.dataSource.query(
      `SELECT id, email, role, status, expires_at, accepted_at, revoked_at, created_at
       FROM workspace_invitations
       WHERE workspace_id = $1
       ORDER BY created_at DESC`,
      [workspaceId]
    );
  }

  async revokeInvitation(workspaceId: string, invitationId: string) {
    await this.dataSource.query(
      `UPDATE workspace_invitations SET status = 'REVOKED', revoked_at = now()
       WHERE id = $1 AND workspace_id = $2 AND status = 'PENDING'`,
      [invitationId, workspaceId]
    );

    return { ok: true };
  }

  async acceptInvitation(userId: string, rawToken: string) {
    const invitationHash = this.tokenHash.hash(rawToken);

    return this.dataSource.transaction(async (manager) => {
      const users = await manager.query<{ email: string }[]>(`SELECT email FROM users WHERE id = $1`, [userId]);
      const user = users[0];

      if (!user) {
        throw new DomainError('USER_NOT_FOUND', 'User was not found.', 404);
      }

      const invitationRows = await manager.query<
        { id: string; workspace_id: string; email: string; role: WorkspaceRole; expires_at: Date; status: InvitationStatus }[]
      >(
        `SELECT id, workspace_id, email, role, expires_at, status
         FROM workspace_invitations
         WHERE token_hash = $1
         FOR UPDATE`,
        [invitationHash]
      );
      const invitation = invitationRows[0];

      if (
        !invitation ||
        invitation.status !== InvitationStatus.Pending ||
        invitation.expires_at <= new Date() ||
        invitation.email.toLowerCase() !== user.email.toLowerCase()
      ) {
        throw new DomainError('INVALID_INVITATION', 'Invitation is invalid or expired.', 400);
      }

      await manager.query(
        `INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
         VALUES ($1, $2, $3, 'ACTIVE')
         ON CONFLICT (workspace_id, user_id)
         DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE', updated_at = now(), suspended_at = NULL`,
        [invitation.workspace_id, userId, invitation.role]
      );
      await manager.query(
        `UPDATE workspace_invitations SET status = 'ACCEPTED', accepted_by_user_id = $2, accepted_at = now()
         WHERE id = $1`,
        [invitation.id, userId]
      );

      return { ok: true, workspaceId: invitation.workspace_id };
    });
  }

  private async assertAnotherOwner(
    manager: Pick<DataSource['manager'], 'query'>,
    workspaceId: string,
    excludedUserId: string
  ) {
    const rows = await manager.query<{ id: string }[]>(
      `SELECT id
       FROM workspace_memberships
       WHERE workspace_id = $1 AND user_id <> $2 AND role = 'OWNER' AND status = 'ACTIVE'
       FOR UPDATE`,
      [workspaceId, excludedUserId]
    );

    if (rows.length < 1) {
      throw new DomainError('LAST_OWNER_REQUIRED', 'A workspace must keep at least one active owner.', 409);
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof QueryFailedError && (error as QueryFailedError & { code?: string }).code === '23505';
  }
}
