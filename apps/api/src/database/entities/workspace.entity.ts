import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn
} from 'typeorm';
import { WorkspaceStatus } from './auth-workspace.enums';
import { UserEntity } from './user.entity';
import { WorkspaceInvitationEntity } from './workspace-invitation.entity';
import { WorkspaceMembershipEntity } from './workspace-membership.entity';

@Entity({ name: 'workspaces' })
export class WorkspaceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 180 })
  name!: string;

  @Column({ type: 'varchar', length: 200, unique: true })
  slug!: string;

  @Column({
    type: 'enum',
    enum: WorkspaceStatus,
    enumName: 'workspace_status',
    default: WorkspaceStatus.Active
  })
  status!: WorkspaceStatus;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  settings!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @VersionColumn({ name: 'lock_version', default: 1 })
  lockVersion!: number;

  @ManyToOne(() => UserEntity, (user) => user.createdWorkspaces, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser!: UserEntity;

  @OneToMany(() => WorkspaceMembershipEntity, (membership) => membership.workspace)
  memberships?: WorkspaceMembershipEntity[];

  @OneToMany(() => WorkspaceInvitationEntity, (invitation) => invitation.workspace)
  invitations?: WorkspaceInvitationEntity[];
}
