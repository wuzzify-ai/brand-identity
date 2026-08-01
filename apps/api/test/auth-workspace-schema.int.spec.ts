import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DataSource, type QueryFailedError } from 'typeorm';
import {
  AuthRefreshTokenEntity,
  AuthIdentityEntity,
  AuthSessionEntity,
  EmailVerificationTokenEntity,
  PasswordResetTokenEntity,
  UserCredentialEntity,
  UserEntity,
  WorkspaceRole,
  WorkspaceEntity,
  WorkspaceInvitationEntity,
  WorkspaceMembershipEntity
} from '../src/database/entities';
import { CreateAuthWorkspaceSchema1795120000000 } from '../src/database/migrations/1795120000000-CreateAuthWorkspaceSchema';
import { fakePasswordHash, hashToken, randomEmail } from '../src/auth/test-utils/auth-test-factories';

const entities = [
  UserEntity,
  UserCredentialEntity,
  AuthIdentityEntity,
  AuthSessionEntity,
  AuthRefreshTokenEntity,
  EmailVerificationTokenEntity,
  PasswordResetTokenEntity,
  WorkspaceEntity,
  WorkspaceMembershipEntity,
  WorkspaceInvitationEntity
];

const describeDbIntegration = process.env.RUN_DB_INTEGRATION === '1' ? describe : describe.skip;

function createDataSource(url: string): DataSource {
  return new DataSource({
    type: 'postgres',
    url,
    synchronize: false,
    migrationsRun: false,
    entities,
    migrations: [CreateAuthWorkspaceSchema1795120000000]
  });
}

function expectPgError(error: unknown, code: string) {
  expect((error as QueryFailedError & { code?: string }).code).toBe(code);
}

async function seedUser(dataSource: DataSource, email = randomEmail()) {
  const result = await dataSource.query<{ id: string }[]>(
    `INSERT INTO users (email, display_name) VALUES ($1, $2) RETURNING id`,
    [email, 'Test User']
  );

  return result[0]?.id as string;
}

async function seedWorkspace(dataSource: DataSource, userId: string) {
  const result = await dataSource.query<{ id: string }[]>(
    `INSERT INTO workspaces (name, slug, created_by_user_id) VALUES ($1, $2, $3) RETURNING id`,
    ['Test Workspace', `test-workspace-${hashToken().slice(0, 12)}`, userId]
  );

  return result[0]?.id as string;
}

describeDbIntegration('auth and workspace schema', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16.4-alpine')
      .withDatabase('brand_identity_test')
      .withUsername('brand_identity')
      .withPassword('brand_identity_dev')
      .start();

    dataSource = createDataSource(container.getConnectionUri());
    await dataSource.initialize();
    await dataSource.runMigrations();
  }, 120_000);

  afterEach(async () => {
    await dataSource.query(`
      TRUNCATE
        workspace_invitations,
        workspace_memberships,
        workspaces,
        password_reset_tokens,
        email_verification_tokens,
        auth_refresh_tokens,
        auth_sessions,
        auth_identities,
        user_credentials,
        users
      RESTART IDENTITY CASCADE
    `);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }

    await container?.stop();
  }, 30_000);

  it('rejects duplicate emails case-insensitively', async () => {
    await seedUser(dataSource, 'CaseSensitive@example.test');

    await expect(
      seedUser(dataSource, 'casesensitive@example.test')
    ).rejects.toSatisfy((error: unknown) => {
      expectPgError(error, '23505');
      return true;
    });
  });

  it('allows only one active refresh token per session', async () => {
    const userId = await seedUser(dataSource);
    const session = await dataSource.query<{ id: string }[]>(
      `INSERT INTO auth_sessions (user_id, expires_at) VALUES ($1, now() + interval '30 days') RETURNING id`,
      [userId]
    );
    const sessionId = session[0]?.id as string;

    await dataSource.query(
      `INSERT INTO auth_refresh_tokens (auth_session_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '30 days')`,
      [sessionId, hashToken()]
    );

    await expect(
      dataSource.query(
        `INSERT INTO auth_refresh_tokens (auth_session_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '30 days')`,
        [sessionId, hashToken()]
      )
    ).rejects.toSatisfy((error: unknown) => {
      expectPgError(error, '23505');
      return true;
    });

    await expect(
      dataSource.query(
        `INSERT INTO auth_refresh_tokens (auth_session_id, token_hash, status, expires_at) VALUES ($1, $2, 'ROTATED', now() + interval '30 days')`,
        [sessionId, hashToken()]
      )
    ).resolves.toBeDefined();
  });

  it('rejects duplicate workspace memberships', async () => {
    const userId = await seedUser(dataSource);
    const workspaceId = await seedWorkspace(dataSource, userId);

    await dataSource.query(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
      [workspaceId, userId]
    );

    await expect(
      dataSource.query(
        `INSERT INTO workspace_memberships (workspace_id, user_id, role) VALUES ($1, $2, 'EDITOR')`,
        [workspaceId, userId]
      )
    ).rejects.toSatisfy((error: unknown) => {
      expectPgError(error, '23505');
      return true;
    });
  });

  it('rejects duplicate pending invitations and owner invitations', async () => {
    const userId = await seedUser(dataSource);
    const workspaceId = await seedWorkspace(dataSource, userId);

    await dataSource.query(
      `INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, invited_by_user_id, expires_at)
       VALUES ($1, $2, 'EDITOR', $3, $4, now() + interval '7 days')`,
      [workspaceId, 'Invitee@example.test', hashToken(), userId]
    );

    await expect(
      dataSource.query(
        `INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, invited_by_user_id, expires_at)
         VALUES ($1, $2, 'VIEWER', $3, $4, now() + interval '7 days')`,
        [workspaceId, 'invitee@example.test', hashToken(), userId]
      )
    ).rejects.toSatisfy((error: unknown) => {
      expectPgError(error, '23505');
      return true;
    });

    await expect(
      dataSource.query(
        `INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, invited_by_user_id, expires_at)
         VALUES ($1, $2, 'OWNER', $3, $4, now() + interval '7 days')`,
        [workspaceId, 'owner@example.test', hashToken(), userId]
      )
    ).rejects.toSatisfy((error: unknown) => {
      expectPgError(error, '23514');
      return true;
    });
  });

  it('keeps password and token hashes out of normal entity serialization', async () => {
    const userRepository = dataSource.getRepository(UserEntity);
    const credentialRepository = dataSource.getRepository(UserCredentialEntity);
    const tokenRepository = dataSource.getRepository(WorkspaceInvitationEntity);

    const user = await userRepository.save(
      userRepository.create({
        email: randomEmail('secret'),
        displayName: 'Secret User'
      })
    );
    await credentialRepository.save(
      credentialRepository.create({
        userId: user.id,
        passwordHash: fakePasswordHash()
      })
    );

    const workspaceId = await seedWorkspace(dataSource, user.id);
    await tokenRepository.save(
      tokenRepository.create({
        workspaceId,
        email: randomEmail('invite'),
        role: WorkspaceRole.Editor,
        tokenHash: hashToken(),
        invitedByUserId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      })
    );

    const credential = await credentialRepository.findOneByOrFail({ userId: user.id });
    const invitation = await tokenRepository.findOneByOrFail({ workspaceId });

    expect(JSON.stringify(credential)).not.toContain('passwordHash');
    expect(JSON.stringify(invitation)).not.toContain('tokenHash');
  });

  it('runs the migration down cleanly in an empty database', async () => {
    const smokeDatabase = `down_smoke_${hashToken().slice(0, 12)}`;
    await dataSource.query(`CREATE DATABASE ${smokeDatabase}`);

    const smokeUrl = new URL(container.getConnectionUri());
    smokeUrl.pathname = `/${smokeDatabase}`;
    const smokeDataSource = createDataSource(smokeUrl.toString());

    try {
      await smokeDataSource.initialize();
      await smokeDataSource.runMigrations();
      await smokeDataSource.undoLastMigration();

      await expect(smokeDataSource.query(`SELECT to_regclass('public.users') AS table_name`)).resolves.toEqual([
        { table_name: null }
      ]);
    } finally {
      if (smokeDataSource.isInitialized) {
        await smokeDataSource.destroy();
      }
    }
  }, 60_000);
});
