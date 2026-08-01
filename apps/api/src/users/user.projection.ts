import type { UserAccountStatus, UserEntity } from '../database/entities';

export type PublicUserProfile = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  preferredLocale: string;
  timezone: string;
  status: UserAccountStatus;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
  deletedAt: string | null;
  lockVersion: number;
};

function dateToJson(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

export function toPublicUserProfile(user: UserEntity): PublicUserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    preferredLocale: user.preferredLocale,
    timezone: user.timezone,
    status: user.status,
    emailVerifiedAt: dateToJson(user.emailVerifiedAt),
    lastLoginAt: dateToJson(user.lastLoginAt),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    suspendedAt: dateToJson(user.suspendedAt),
    deletedAt: dateToJson(user.deletedAt),
    lockVersion: user.lockVersion
  };
}
