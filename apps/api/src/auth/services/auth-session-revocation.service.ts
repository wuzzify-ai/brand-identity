import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthSessionEntity } from '../../database/entities';

@Injectable()
export class AuthSessionRevocationService {
  constructor(
    @InjectRepository(AuthSessionEntity) private readonly sessions: Repository<AuthSessionEntity>
  ) {}

  async revokeAllForUser(userId: string, reason: string): Promise<number> {
    const result = await this.sessions
      .createQueryBuilder()
      .update(AuthSessionEntity)
      .set({
        revokedAt: () => 'now()',
        revokeReason: reason
      })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();

    return result.affected ?? 0;
  }
}
