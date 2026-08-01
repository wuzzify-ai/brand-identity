import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn
} from 'typeorm';
import { AuthIdentityEntity } from './auth-identity.entity';
import { AuthSessionEntity } from './auth-session.entity';
import { EmailVerificationTokenEntity } from './email-verification-token.entity';
import { PasswordResetTokenEntity } from './password-reset-token.entity';
import { UserCredentialEntity } from './user-credential.entity';
import { WorkspaceMembershipEntity } from './workspace-membership.entity';
import { WorkspaceEntity } from './workspace.entity';
import { WorkspaceInvitationEntity } from './workspace-invitation.entity';
import { UserAccountStatus } from './auth-workspace.enums';

@Entity({ name: 'users' })
@Index('ix_users_status_created', ['status', 'createdAt'])
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'citext', unique: true })
  email!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 180 })
  displayName!: string;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl!: string | null;

  @Column({ name: 'preferred_locale', type: 'varchar', length: 35, default: 'en' })
  preferredLocale!: string;

  @Column({ type: 'varchar', length: 100, default: 'UTC' })
  timezone!: string;

  @Column({
    type: 'enum',
    enum: UserAccountStatus,
    enumName: 'user_account_status',
    default: UserAccountStatus.PendingVerification
  })
  status!: UserAccountStatus;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'suspended_at', type: 'timestamptz', nullable: true })
  suspendedAt!: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @VersionColumn({ name: 'lock_version', default: 1 })
  lockVersion!: number;

  @OneToOne(() => UserCredentialEntity, (credential) => credential.user)
  credential?: UserCredentialEntity;

  @OneToMany(() => AuthIdentityEntity, (identity) => identity.user)
  identities?: AuthIdentityEntity[];

  @OneToMany(() => AuthSessionEntity, (session) => session.user)
  sessions?: AuthSessionEntity[];

  @OneToMany(() => EmailVerificationTokenEntity, (token) => token.user)
  emailVerificationTokens?: EmailVerificationTokenEntity[];

  @OneToMany(() => PasswordResetTokenEntity, (token) => token.user)
  passwordResetTokens?: PasswordResetTokenEntity[];

  @OneToMany(() => WorkspaceEntity, (workspace) => workspace.createdByUser)
  createdWorkspaces?: WorkspaceEntity[];

  @OneToMany(() => WorkspaceMembershipEntity, (membership) => membership.user)
  workspaceMemberships?: WorkspaceMembershipEntity[];

  @OneToMany(() => WorkspaceInvitationEntity, (invitation) => invitation.invitedByUser)
  sentWorkspaceInvitations?: WorkspaceInvitationEntity[];
}
