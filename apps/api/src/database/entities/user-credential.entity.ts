import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity({ name: 'user_credentials' })
export class UserCredentialEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'password_hash', type: 'text', select: false })
  passwordHash!: string;

  @Column({ name: 'password_algorithm', type: 'varchar', length: 30, default: 'argon2id' })
  passwordAlgorithm!: string;

  @Column({ name: 'password_changed_at', type: 'timestamptz', default: () => 'now()' })
  passwordChangedAt!: Date;

  @Column({ name: 'failed_login_attempts', type: 'smallint', default: 0 })
  failedLoginAttempts!: number;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => UserEntity, (user) => user.credential, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  toJSON() {
    const safe = { ...this } as Record<string, unknown>;
    delete safe.passwordHash;
    return safe;
  }
}
