import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn
} from 'typeorm';
import { AuthRefreshTokenStatus } from './auth-workspace.enums';
import { AuthSessionEntity } from './auth-session.entity';

@Entity({ name: 'auth_refresh_tokens' })
@Index('ix_auth_refresh_tokens_session_status', ['authSessionId', 'status', 'issuedAt'])
export class AuthRefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'auth_session_id', type: 'uuid' })
  authSessionId!: string;

  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true, select: false })
  tokenHash!: string;

  @Column({
    type: 'enum',
    enum: AuthRefreshTokenStatus,
    enumName: 'auth_refresh_token_status',
    default: AuthRefreshTokenStatus.Active
  })
  status!: AuthRefreshTokenStatus;

  @Column({ name: 'replaced_by_token_id', type: 'uuid', nullable: true })
  replacedByTokenId!: string | null;

  @Column({ name: 'issued_at', type: 'timestamptz', default: () => 'now()' })
  issuedAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'rotated_at', type: 'timestamptz', nullable: true })
  rotatedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @ManyToOne(() => AuthSessionEntity, (session) => session.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'auth_session_id' })
  session!: AuthSessionEntity;

  @OneToOne(() => AuthRefreshTokenEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'replaced_by_token_id' })
  replacedByToken?: AuthRefreshTokenEntity | null;

  toJSON() {
    const safe = { ...this } as Record<string, unknown>;
    delete safe.tokenHash;
    return safe;
  }
}
