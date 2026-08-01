import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../src/common/domain-error';
import { UserAccountStatus, type UserEntity } from '../src/database/entities';
import type { AuthSessionRevocationService } from '../src/auth/services/auth-session-revocation.service';
import type { UsersRepository } from '../src/users/repositories/users.repository';
import { UsersService } from '../src/users/users.service';

function userFixture(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: '6f063f66-c8ae-4da5-8099-a6716d8652da',
    email: 'user@example.test',
    displayName: 'User One',
    avatarUrl: null,
    preferredLocale: 'en',
    timezone: 'UTC',
    status: UserAccountStatus.Active,
    emailVerifiedAt: null,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    suspendedAt: null,
    deletedAt: null,
    lockVersion: 1,
    ...overrides
  } as UserEntity;
}

function createService(user: UserEntity | null = userFixture()) {
  const repository = {
    findById: vi.fn(async () => user),
    updateProfile: vi.fn(async () => true),
    softDelete: vi.fn(async () => true),
    setStatus: vi.fn(async () => true)
  };
  const sessions = {
    revokeAllForUser: vi.fn(async () => 2)
  };

  return {
    service: new UsersService(
      repository as unknown as UsersRepository,
      sessions as unknown as AuthSessionRevocationService
    ),
    repository,
    sessions
  };
}

describe('UsersService', () => {
  it('returns a safe public projection', async () => {
    const { service } = createService();

    await expect(service.getMe('user-id')).resolves.toEqual({
      id: '6f063f66-c8ae-4da5-8099-a6716d8652da',
      email: 'user@example.test',
      displayName: 'User One',
      avatarUrl: null,
      preferredLocale: 'en',
      timezone: 'UTC',
      status: UserAccountStatus.Active,
      emailVerifiedAt: null,
      lastLoginAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      suspendedAt: null,
      deletedAt: null,
      lockVersion: 1
    });
  });

  it('rejects unsupported timezone updates', async () => {
    const { service } = createService();

    await expect(
      service.updateMe('user-id', { timezone: 'Moon/Base', lockVersion: 1 })
    ).rejects.toMatchObject({
      code: 'INVALID_TIMEZONE',
      statusCode: 400
    });
  });

  it('returns a conflict for stale optimistic updates', async () => {
    const { service, repository } = createService();
    repository.updateProfile.mockResolvedValue(false);

    await expect(
      service.updateMe('user-id', { displayName: 'Updated', lockVersion: 1 })
    ).rejects.toMatchObject({
      code: 'PROFILE_UPDATE_CONFLICT',
      statusCode: 409
    });
  });

  it('soft deletes users and revokes sessions', async () => {
    const { service, repository, sessions } = createService();

    await service.softDeleteMe('user-id');

    expect(repository.softDelete).toHaveBeenCalledWith(
      'user-id',
      expect.stringMatching(/^deleted-[0-9a-f-]+@deleted\.local$/)
    );
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-id', 'account_deleted');
  });

  it('blocks suspended and deleted users from authenticating', () => {
    const { service } = createService();

    expect(() => service.assertCanAuthenticate(UserAccountStatus.Active)).not.toThrow();
    expect(() => service.assertCanAuthenticate(UserAccountStatus.Suspended)).toThrow(DomainError);
    expect(() => service.assertCanAuthenticate(UserAccountStatus.Deleted)).toThrow(DomainError);
  });
});
