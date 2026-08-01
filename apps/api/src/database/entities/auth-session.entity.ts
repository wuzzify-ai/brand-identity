import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique
} from 'typeorm';
import { AuthRefreshTokenEntity } from './auth-refresh-token.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'auth_sessions' })
@Unique('auth_sessions_token_family_unique', ['tokenFamilyId'])
@Index('ix_auth_sessions_user_active', ['userId', 'expiresAt'])
export class AuthSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'token_family_id', type: 'uuid', default: () => 'gen_random_uuid()' })
  tokenFamilyId!: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ name: 'ip_hash', type: 'char', length: 64, nullable: true, select: false })
  ipHash!: string | null;

  @Column({ name: 'device_name', type: 'varchar', length: 180, nullable: true })
  deviceName!: string | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', default: () => 'now()' })
  lastUsedAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'revoke_reason', type: 'varchar', length: 180, nullable: true })
  revokeReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => UserEntity, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @OneToMany(() => AuthRefreshTokenEntity, (token) => token.session)
  refreshTokens?: AuthRefreshTokenEntity[];

  toJSON() {
    const safe = { ...this } as Record<string, unknown>;
    delete safe.ipHash;
    return safe;
  }
}
