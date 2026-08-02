import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Registration is now immediately verified. Bring existing pending accounts
 * into the same state so users already created before this change can sign in.
 */
export class MarkExistingUsersVerified1795135000000 implements MigrationInterface {
  name = 'MarkExistingUsersVerified1795135000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE users
       SET status = 'ACTIVE',
           email_verified_at = COALESCE(email_verified_at, now()),
           updated_at = now(),
           lock_version = lock_version + 1
       WHERE status = 'PENDING_VERIFICATION'`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Verification is intentionally irreversible; do not deactivate accounts
    // that may have logged in after this migration.
    void queryRunner;
  }
}
