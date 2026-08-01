import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InvitationStatus,
  MembershipStatus,
  WorkspaceInvitationEntity,
  WorkspaceMembershipEntity,
  WorkspaceRole
} from '../../database/entities';

@Injectable()
export class WorkspaceQueriesRepository {
  constructor(
    @InjectRepository(WorkspaceMembershipEntity)
    private readonly memberships: Repository<WorkspaceMembershipEntity>,
    @InjectRepository(WorkspaceInvitationEntity)
    private readonly invitations: Repository<WorkspaceInvitationEntity>
  ) {}

  findActiveMembership(workspaceId: string, userId: string): Promise<WorkspaceMembershipEntity | null> {
    return this.memberships.findOne({
      where: {
        workspaceId,
        userId,
        status: MembershipStatus.Active
      }
    });
  }

  countActiveOwners(workspaceId: string): Promise<number> {
    return this.memberships.count({
      where: {
        workspaceId,
        role: WorkspaceRole.Owner,
        status: MembershipStatus.Active
      }
    });
  }

  findPendingInvitation(workspaceId: string, email: string): Promise<WorkspaceInvitationEntity | null> {
    return this.invitations.findOne({
      where: {
        workspaceId,
        email,
        status: InvitationStatus.Pending
      }
    });
  }
}
