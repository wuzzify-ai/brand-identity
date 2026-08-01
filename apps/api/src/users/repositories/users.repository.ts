import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAccountStatus, UserEntity } from '../../database/entities';

export type ProfileUpdate = {
  displayName?: string;
  avatarUrl?: string | null;
  preferredLocale?: string;
  timezone?: string;
};

@Injectable()
export class UsersRepository {
  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) {}

  findById(userId: string): Promise<UserEntity | null> {
    return this.users.findOne({ where: { id: userId } });
  }

  async updateProfile(userId: string, lockVersion: number, update: ProfileUpdate): Promise<boolean> {
    const result = await this.users
      .createQueryBuilder()
      .update(UserEntity)
      .set({
        ...update,
        lockVersion: () => 'lock_version + 1',
        updatedAt: () => 'now()'
      })
      .where('id = :userId', { userId })
      .andWhere('lock_version = :lockVersion', { lockVersion })
      .andWhere('status <> :deletedStatus', { deletedStatus: UserAccountStatus.Deleted })
      .execute();

    return result.affected === 1;
  }

  async softDelete(userId: string, anonymizedEmail: string): Promise<boolean> {
    const result = await this.users
      .createQueryBuilder()
      .update(UserEntity)
      .set({
        email: anonymizedEmail,
        displayName: 'Deleted user',
        avatarUrl: null,
        status: UserAccountStatus.Deleted,
        deletedAt: () => 'now()',
        updatedAt: () => 'now()',
        lockVersion: () => 'lock_version + 1'
      })
      .where('id = :userId', { userId })
      .andWhere('status <> :deletedStatus', { deletedStatus: UserAccountStatus.Deleted })
      .execute();

    return result.affected === 1;
  }

  async setStatus(userId: string, status: UserAccountStatus): Promise<boolean> {
    const patch =
      status === UserAccountStatus.Suspended
        ? { status, suspendedAt: () => 'now()', updatedAt: () => 'now()', lockVersion: () => 'lock_version + 1' }
        : { status, suspendedAt: null, updatedAt: () => 'now()', lockVersion: () => 'lock_version + 1' };

    const result = await this.users
      .createQueryBuilder()
      .update(UserEntity)
      .set(patch)
      .where('id = :userId', { userId })
      .andWhere('status <> :deletedStatus', { deletedStatus: UserAccountStatus.Deleted })
      .execute();

    return result.affected === 1;
  }
}
