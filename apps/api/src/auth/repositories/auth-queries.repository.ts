import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuthRefreshTokenEntity,
  AuthRefreshTokenStatus,
  AuthSessionEntity,
  UserCredentialEntity,
  UserEntity
} from '../../database/entities';

@Injectable()
export class AuthQueriesRepository {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(UserCredentialEntity)
    private readonly credentials: Repository<UserCredentialEntity>,
    @InjectRepository(AuthSessionEntity)
    private readonly sessions: Repository<AuthSessionEntity>,
    @InjectRepository(AuthRefreshTokenEntity)
    private readonly refreshTokens: Repository<AuthRefreshTokenEntity>
  ) {}

  findUserByEmail(email: string): Promise<UserEntity | null> {
    return this.users.findOne({ where: { email } });
  }

  findCredentialByUserIdWithHash(userId: string): Promise<UserCredentialEntity | null> {
    return this.credentials
      .createQueryBuilder('credential')
      .addSelect('credential.passwordHash')
      .where('credential.user_id = :userId', { userId })
      .getOne();
  }

  findActiveSessionById(sessionId: string): Promise<AuthSessionEntity | null> {
    return this.sessions
      .createQueryBuilder('session')
      .where('session.id = :sessionId', { sessionId })
      .andWhere('session.revoked_at IS NULL')
      .andWhere('session.expires_at > now()')
      .getOne();
  }

  findActiveRefreshTokenByHash(tokenHash: string): Promise<AuthRefreshTokenEntity | null> {
    return this.refreshTokens
      .createQueryBuilder('refreshToken')
      .addSelect('refreshToken.tokenHash')
      .where('refreshToken.token_hash = :tokenHash', { tokenHash })
      .andWhere('refreshToken.status = :status', { status: AuthRefreshTokenStatus.Active })
      .andWhere('refreshToken.expires_at > now()')
      .getOne();
  }
}
