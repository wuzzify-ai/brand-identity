import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { InvitationStatus, WorkspaceRole } from './auth-workspace.enums';
import { UserEntity } from './user.entity';
import { WorkspaceEntity } from './workspace.entity';

@Entity({ name: 'workspace_invitations' })
@Index('ix_workspace_invitations_workspace_status', ['workspaceId', 'status', 'expiresAt'])
export class WorkspaceInvitationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @Column({ type: 'citext' })
  email!: string;

  @Column({ type: 'enum', enum: WorkspaceRole, enumName: 'workspace_role' })
  role!: WorkspaceRole;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    enumName: 'invitation_status',
    default: InvitationStatus.Pending
  })
  status!: InvitationStatus;

  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true, select: false })
  tokenHash!: string;

  @Column({ name: 'invited_by_user_id', type: 'uuid' })
  invitedByUserId!: string;

  @Column({ name: 'accepted_by_user_id', type: 'uuid', nullable: true })
  acceptedByUserId!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => WorkspaceEntity, (workspace) => workspace.invitations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => UserEntity, (user) => user.sentWorkspaceInvitations, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'invited_by_user_id' })
  invitedByUser!: UserEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'accepted_by_user_id' })
  acceptedByUser?: UserEntity | null;

  toJSON() {
    const safe = { ...this } as Record<string, unknown>;
    delete safe.tokenHash;
    return safe;
  }
}
