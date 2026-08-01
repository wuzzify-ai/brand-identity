import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique
} from 'typeorm';
import { AuthIdentityProvider } from './auth-workspace.enums';
import { UserEntity } from './user.entity';

@Entity({ name: 'auth_identities' })
@Unique('auth_identities_provider_subject_unique', ['provider', 'providerSubject'])
@Unique('auth_identities_user_provider_unique', ['userId', 'provider'])
@Index('ix_auth_identities_user', ['userId'])
export class AuthIdentityEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: AuthIdentityProvider, enumName: 'auth_identity_provider' })
  provider!: AuthIdentityProvider;

  @Column({ name: 'provider_subject', type: 'varchar', length: 500 })
  providerSubject!: string;

  @Column({ name: 'email_at_provider', type: 'citext', nullable: true })
  emailAtProvider!: string | null;

  @Column({ name: 'profile_snapshot', type: 'jsonb', default: () => "'{}'::jsonb" })
  profileSnapshot!: Record<string, unknown>;

  @Column({ name: 'linked_at', type: 'timestamptz', default: () => 'now()' })
  linkedAt!: Date;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @ManyToOne(() => UserEntity, (user) => user.identities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;
}
