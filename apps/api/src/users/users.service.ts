import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../common/domain-error';
import { UserAccountStatus } from '../database/entities';
import { AuthSessionRevocationService } from '../auth/services/auth-session-revocation.service';
import type { UpdateMeDto } from './dto/update-me.dto';
import { toPublicUserProfile, type PublicUserProfile } from './user.projection';
import { UsersRepository } from './repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly sessions: AuthSessionRevocationService
  ) {}

  async getMe(userId: string): Promise<PublicUserProfile> {
    const user = await this.usersRepository.findById(userId);

    if (!user || user.status === UserAccountStatus.Deleted) {
      throw new DomainError('USER_NOT_FOUND', 'User was not found.', 404);
    }

    return toPublicUserProfile(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<PublicUserProfile> {
    this.assertValidTimezone(dto.timezone);

    const update: Record<string, string | null> = {};

    if (dto.displayName !== undefined) {
      update.displayName = dto.displayName.trim();
    }

    if (dto.avatarUrl !== undefined) {
      update.avatarUrl = dto.avatarUrl;
    }

    if (dto.preferredLocale !== undefined) {
      update.preferredLocale = dto.preferredLocale;
    }

    if (dto.timezone !== undefined) {
      update.timezone = dto.timezone;
    }

    const didUpdate = await this.usersRepository.updateProfile(userId, dto.lockVersion, update);

    if (!didUpdate) {
      throw new DomainError('PROFILE_UPDATE_CONFLICT', 'Profile was changed by another request.', 409);
    }

    return this.getMe(userId);
  }

  async softDeleteMe(userId: string): Promise<void> {
    const anonymizedEmail = `deleted-${randomUUID()}@deleted.local`;
    const didDelete = await this.usersRepository.softDelete(userId, anonymizedEmail);

    if (!didDelete) {
      throw new DomainError('USER_NOT_FOUND', 'User was not found.', 404);
    }

    await this.sessions.revokeAllForUser(userId, 'account_deleted');
  }

  async suspendUser(userId: string): Promise<void> {
    const didSuspend = await this.usersRepository.setStatus(userId, UserAccountStatus.Suspended);

    if (!didSuspend) {
      throw new DomainError('USER_NOT_FOUND', 'User was not found.', 404);
    }

    await this.sessions.revokeAllForUser(userId, 'account_suspended');
  }

  async reactivateUser(userId: string): Promise<void> {
    const didReactivate = await this.usersRepository.setStatus(userId, UserAccountStatus.Active);

    if (!didReactivate) {
      throw new DomainError('USER_NOT_FOUND', 'User was not found.', 404);
    }
  }

  assertCanAuthenticate(status: UserAccountStatus): void {
    if (status === UserAccountStatus.Deleted) {
      throw new DomainError('USER_DELETED', 'This account is no longer active.', 403);
    }

    if (status === UserAccountStatus.Suspended) {
      throw new DomainError('USER_SUSPENDED', 'This account is suspended.', 403);
    }
  }

  private assertValidTimezone(timezone: string | undefined): void {
    if (!timezone) {
      return;
    }

    const supportedTimezones = new Set(Intl.supportedValuesOf('timeZone'));

    if (!supportedTimezones.has(timezone)) {
      throw new DomainError('INVALID_TIMEZONE', 'Timezone is not supported.', 400);
    }
  }
}
