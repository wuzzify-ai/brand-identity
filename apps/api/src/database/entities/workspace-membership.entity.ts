import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn
} from 'typeorm';
import { MembershipStatus, WorkspaceRole } from './auth-workspace.enums';
import { UserEntity } from './user.entity';
import { WorkspaceEntity } from './workspace.entity';

@Entity({ name: 'workspace_memberships' })
@Unique('workspace_memberships_workspace_user_unique', ['workspaceId', 'userId'])
@Index('ix_workspace_memberships_user_status', ['userId', 'status', 'workspaceId'])
@Index('ix_workspace_memberships_workspace_role', ['workspaceId', 'role', 'status'])
export class WorkspaceMembershipEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: WorkspaceRole, enumName: 'workspace_role' })
  role!: WorkspaceRole;

  @Column({
    type: 'enum',
    enum: MembershipStatus,
    enumName: 'membership_status',
    default: MembershipStatus.Active
  })
  status!: MembershipStatus;

  @Column({ name: 'joined_at', type: 'timestamptz', default: () => 'now()' })
  joinedAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'suspended_at', type: 'timestamptz', nullable: true })
  suspendedAt!: Date | null;

  @ManyToOne(() => WorkspaceEntity, (workspace) => workspace.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => UserEntity, (user) => user.workspaceMemberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;
}
