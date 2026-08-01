import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthWorkspaceSchema1795120000000 implements MigrationInterface {
  name = 'CreateAuthWorkspaceSchema1795120000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext`);

    await queryRunner.query(
      `CREATE TYPE user_account_status AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DELETED')`
    );
    await queryRunner.query(
      `CREATE TYPE auth_identity_provider AS ENUM ('GOOGLE', 'GITHUB', 'MICROSOFT', 'OIDC')`
    );
    await queryRunner.query(
      `CREATE TYPE auth_refresh_token_status AS ENUM ('ACTIVE', 'ROTATED', 'REVOKED', 'EXPIRED')`
    );
    await queryRunner.query(`CREATE TYPE workspace_status AS ENUM ('ACTIVE', 'ARCHIVED')`);
    await queryRunner.query(`CREATE TYPE workspace_role AS ENUM ('OWNER', 'EDITOR', 'REVIEWER', 'VIEWER')`);
    await queryRunner.query(`CREATE TYPE membership_status AS ENUM ('ACTIVE', 'SUSPENDED')`);
    await queryRunner.query(
      `CREATE TYPE invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')`
    );

    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email citext NOT NULL UNIQUE,
        display_name varchar(180) NOT NULL,
        avatar_url text,
        preferred_locale varchar(35) NOT NULL DEFAULT 'en',
        timezone varchar(100) NOT NULL DEFAULT 'UTC',
        status user_account_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
        email_verified_at timestamptz,
        last_login_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        suspended_at timestamptz,
        deleted_at timestamptz,
        lock_version integer NOT NULL DEFAULT 1,
        CONSTRAINT users_email_not_blank CHECK (length(btrim(email::text)) > 0),
        CONSTRAINT users_display_name_not_blank CHECK (length(btrim(display_name)) > 0),
        CONSTRAINT users_lock_version_positive CHECK (lock_version > 0)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_users_status_created ON users (status, created_at DESC)`);

    await queryRunner.query(`
      CREATE TABLE user_credentials (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        password_hash text NOT NULL,
        password_algorithm varchar(30) NOT NULL DEFAULT 'argon2id',
        password_changed_at timestamptz NOT NULL DEFAULT now(),
        failed_login_attempts smallint NOT NULL DEFAULT 0,
        locked_until timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT user_credentials_failed_attempts_nonnegative CHECK (failed_login_attempts >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE auth_identities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider auth_identity_provider NOT NULL,
        provider_subject varchar(500) NOT NULL,
        email_at_provider citext,
        profile_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
        linked_at timestamptz NOT NULL DEFAULT now(),
        last_login_at timestamptz,
        CONSTRAINT auth_identities_provider_subject_unique UNIQUE (provider, provider_subject),
        CONSTRAINT auth_identities_user_provider_unique UNIQUE (user_id, provider)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_auth_identities_user ON auth_identities (user_id)`);

    await queryRunner.query(`
      CREATE TABLE auth_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_family_id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_agent text,
        ip_hash char(64),
        device_name varchar(180),
        last_used_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        revoke_reason varchar(180),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT auth_sessions_expiry_after_creation CHECK (expires_at > created_at),
        CONSTRAINT auth_sessions_token_family_unique UNIQUE (token_family_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX ix_auth_sessions_user_active ON auth_sessions (user_id, expires_at DESC) WHERE revoked_at IS NULL`
    );

    await queryRunner.query(`
      CREATE TABLE auth_refresh_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        auth_session_id uuid NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
        token_hash char(64) NOT NULL UNIQUE,
        status auth_refresh_token_status NOT NULL DEFAULT 'ACTIVE',
        replaced_by_token_id uuid REFERENCES auth_refresh_tokens(id) ON DELETE SET NULL,
        issued_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        rotated_at timestamptz,
        revoked_at timestamptz,
        CONSTRAINT auth_refresh_tokens_expiry_after_issue CHECK (expires_at > issued_at)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_auth_refresh_tokens_one_active_per_session ON auth_refresh_tokens (auth_session_id) WHERE status = 'ACTIVE'`
    );
    await queryRunner.query(
      `CREATE INDEX ix_auth_refresh_tokens_session_status ON auth_refresh_tokens (auth_session_id, status, issued_at DESC)`
    );

    await queryRunner.query(`
      CREATE TABLE email_verification_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash char(64) NOT NULL UNIQUE,
        email_snapshot citext NOT NULL,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT email_verification_expiry_after_creation CHECK (expires_at > created_at)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX ix_email_verification_tokens_user ON email_verification_tokens (user_id, created_at DESC)`
    );

    await queryRunner.query(`
      CREATE TABLE password_reset_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash char(64) NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        requester_ip_hash char(64),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT password_reset_expiry_after_creation CHECK (expires_at > created_at)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX ix_password_reset_tokens_user ON password_reset_tokens (user_id, created_at DESC)`
    );

    await queryRunner.query(`
      CREATE TABLE workspaces (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(180) NOT NULL,
        slug varchar(200) NOT NULL,
        status workspace_status NOT NULL DEFAULT 'ACTIVE',
        created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        settings jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        archived_at timestamptz,
        lock_version integer NOT NULL DEFAULT 1,
        CONSTRAINT workspaces_name_not_blank CHECK (length(btrim(name)) > 0),
        CONSTRAINT workspaces_slug_not_blank CHECK (length(btrim(slug)) > 0),
        CONSTRAINT workspaces_slug_unique UNIQUE (slug),
        CONSTRAINT workspaces_lock_version_positive CHECK (lock_version > 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE workspace_memberships (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role workspace_role NOT NULL,
        status membership_status NOT NULL DEFAULT 'ACTIVE',
        joined_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        suspended_at timestamptz,
        CONSTRAINT workspace_memberships_workspace_user_unique UNIQUE (workspace_id, user_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX ix_workspace_memberships_user_status ON workspace_memberships (user_id, status, workspace_id)`
    );
    await queryRunner.query(
      `CREATE INDEX ix_workspace_memberships_workspace_role ON workspace_memberships (workspace_id, role, status)`
    );

    await queryRunner.query(`
      CREATE TABLE workspace_invitations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        email citext NOT NULL,
        role workspace_role NOT NULL,
        status invitation_status NOT NULL DEFAULT 'PENDING',
        token_hash char(64) NOT NULL UNIQUE,
        invited_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        accepted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        expires_at timestamptz NOT NULL,
        accepted_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT workspace_invitations_no_owner_role CHECK (role <> 'OWNER'),
        CONSTRAINT workspace_invitations_expiry_after_creation CHECK (expires_at > created_at)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_workspace_invitations_pending_email ON workspace_invitations (workspace_id, email) WHERE status = 'PENDING'`
    );
    await queryRunner.query(
      `CREATE INDEX ix_workspace_invitations_workspace_status ON workspace_invitations (workspace_id, status, expires_at)`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS workspace_invitations`);
    await queryRunner.query(`DROP TABLE IF EXISTS workspace_memberships`);
    await queryRunner.query(`DROP TABLE IF EXISTS workspaces`);
    await queryRunner.query(`DROP TABLE IF EXISTS password_reset_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS email_verification_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth_refresh_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth_sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth_identities`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_credentials`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);

    await queryRunner.query(`DROP TYPE IF EXISTS invitation_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS membership_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS workspace_role`);
    await queryRunner.query(`DROP TYPE IF EXISTS workspace_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS auth_refresh_token_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS auth_identity_provider`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_account_status`);
  }
}
