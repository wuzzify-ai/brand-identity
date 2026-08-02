import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash as argonHash, verify as argonVerify } from 'argon2';
import { DataSource, QueryFailedError } from 'typeorm';
import { DomainError } from '../common/domain-error';
import { MembershipStatus, UserAccountStatus, WorkspaceRole } from '../database/entities';
import { AccessTokenService } from './access-token.service';
import { AuthEmailService } from './email/auth-email.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import { PasswordPolicyService } from './password-policy.service';
import { InMemoryRateLimiterService } from './rate-limit/in-memory-rate-limiter.service';
import { TokenHashService } from './token-hash.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

export type GenericAuthResponse = {
  ok: true;
  message: string;
};

export type AuthTokenResponse = {
  accessToken: string;
  expiresIn: number;
};

type LoginRow = {
  id: string;
  status: UserAccountStatus;
  password_hash: string;
};

type RefreshRow = {
  id: string;
  auth_session_id: string;
  status: 'ACTIVE' | 'ROTATED' | 'REVOKED' | 'EXPIRED';
  expires_at: Date;
  user_id: string;
  user_status: UserAccountStatus;
  session_revoked_at: Date | null;
};

export type SafeSession = {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  current: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly tokenHash: TokenHashService,
    private readonly accessTokens: AccessTokenService,
    private readonly email: AuthEmailService,
    private readonly rateLimiter: InMemoryRateLimiterService,
    private readonly config: ConfigService
  ) {}

  async register(dto: RegisterDto, ipKey: string): Promise<GenericAuthResponse> {
    this.rateLimiter.consume(`register:ip:${ipKey}`, 10, 60 * 60 * 1000);
    this.rateLimiter.consume(`register:email:${dto.email}`, 5, 60 * 60 * 1000);
    this.passwordPolicy.assertAcceptable(dto.password);

    const passwordHash = await argonHash(dto.password, {
      type: 2,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1
    });
    try {
      await this.dataSource.transaction(async (manager) => {
        const userRows = await manager.query<{ id: string }[]>(
          `INSERT INTO users (email, display_name, status, email_verified_at)
           VALUES ($1, $2, $3, now())
           RETURNING id`,
          [dto.email, dto.displayName.trim(), UserAccountStatus.Active]
        );
        const userId = userRows[0]?.id;

        await manager.query(
          `INSERT INTO user_credentials (user_id, password_hash) VALUES ($1, $2)`,
          [userId, passwordHash]
        );

        const workspaceRows = await manager.query<{ id: string }[]>(
          `INSERT INTO workspaces (name, slug, created_by_user_id) VALUES ($1, $2, $3) RETURNING id`,
          [dto.workspaceName.trim(), dto.workspaceSlug, userId]
        );
        const workspaceId = workspaceRows[0]?.id;

        await manager.query(
          `INSERT INTO workspace_memberships (workspace_id, user_id, role, status) VALUES ($1, $2, $3, $4)`,
          [workspaceId, userId, WorkspaceRole.Owner, MembershipStatus.Active]
        );

      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new DomainError('REGISTRATION_CONFLICT', 'An account or workspace already exists.', 409);
      }

      throw error;
    }

    return {
      ok: true,
      message: 'Account created. You can sign in.'
    };
  }

  async login(dto: LoginDto, metadata: { ipKey: string; userAgent?: string }): Promise<AuthTokenResponse & { refreshToken: string; refreshMaxAgeMs: number }> {
    this.rateLimiter.consume(`login:ip:${metadata.ipKey}`, 20, 15 * 60 * 1000);
    this.rateLimiter.consume(`login:email:${dto.email}`, 10, 15 * 60 * 1000);

    const rows = await this.dataSource.query<LoginRow[]>(
      `SELECT users.id, users.status, user_credentials.password_hash
       FROM users
       JOIN user_credentials ON user_credentials.user_id = users.id
       WHERE users.email = $1`,
      [dto.email]
    );
    const row = rows[0];

    if (!row) {
      throw new DomainError('INVALID_LOGIN', 'Email or password is incorrect.', 401);
    }

    const passwordMatches = await argonVerify(row.password_hash, dto.password);

    if (!passwordMatches) {
      throw new DomainError('INVALID_LOGIN', 'Email or password is incorrect.', 401);
    }

    this.assertUserStatusCanAuthenticate(row.status);
    const sessionMetadata: { userAgent?: string; deviceName?: string } = {};

    if (metadata.userAgent) {
      sessionMetadata.userAgent = metadata.userAgent;
    }

    if (dto.deviceName) {
      sessionMetadata.deviceName = dto.deviceName;
    }

    return this.createSession(row.id, sessionMetadata);
  }

  async refresh(rawRefreshToken: string | null): Promise<AuthTokenResponse & { refreshToken: string; refreshMaxAgeMs: number }> {
    if (!rawRefreshToken) {
      throw new DomainError('REFRESH_TOKEN_REQUIRED', 'Refresh token is required.', 401);
    }

    const presentedHash = this.tokenHash.hash(rawRefreshToken);
    const refreshTtlDays = this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS');
    const nextRawToken = this.tokenHash.generateRawToken();
    const nextHash = this.tokenHash.hash(nextRawToken);

    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<RefreshRow[]>(
        `SELECT
           auth_refresh_tokens.id,
           auth_refresh_tokens.auth_session_id,
           auth_refresh_tokens.status,
           auth_refresh_tokens.expires_at,
           auth_sessions.user_id,
           users.status AS user_status,
           auth_sessions.revoked_at AS session_revoked_at
         FROM auth_refresh_tokens
         JOIN auth_sessions ON auth_sessions.id = auth_refresh_tokens.auth_session_id
         JOIN users ON users.id = auth_sessions.user_id
         WHERE auth_refresh_tokens.token_hash = $1
         FOR UPDATE OF auth_refresh_tokens, auth_sessions`,
        [presentedHash]
      );
      const token = rows[0];

      if (!token) {
        throw new DomainError('INVALID_REFRESH_TOKEN', 'Refresh token is invalid.', 401);
      }

      if (token.status !== 'ACTIVE' || token.session_revoked_at) {
        await manager.query(
          `UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, now()), revoke_reason = 'refresh_replay' WHERE id = $1`,
          [token.auth_session_id]
        );
        throw new DomainError('INVALID_REFRESH_TOKEN', 'Refresh token is invalid.', 401);
      }

      if (token.expires_at <= new Date()) {
        await manager.query(`UPDATE auth_refresh_tokens SET status = 'EXPIRED' WHERE id = $1`, [token.id]);
        throw new DomainError('INVALID_REFRESH_TOKEN', 'Refresh token is invalid.', 401);
      }

      this.assertUserStatusCanAuthenticate(token.user_status);

      // The partial unique index permits only one ACTIVE refresh token per session.
      // Rotate the presented token before inserting its replacement so the insert
      // cannot violate that invariant.
      await manager.query(
        `UPDATE auth_refresh_tokens
         SET status = 'ROTATED', rotated_at = now()
         WHERE id = $1`,
        [token.id]
      );

      const inserted = await manager.query<{ id: string }[]>(
        `INSERT INTO auth_refresh_tokens (auth_session_id, token_hash, expires_at)
         VALUES ($1, $2, now() + ($3 || ' days')::interval)
         RETURNING id`,
        [token.auth_session_id, nextHash, refreshTtlDays]
      );

      await manager.query(
        `UPDATE auth_refresh_tokens
         SET replaced_by_token_id = $2
         WHERE id = $1`,
        [token.id, inserted[0]?.id]
      );

      await manager.query(`UPDATE auth_sessions SET last_used_at = now() WHERE id = $1`, [token.auth_session_id]);

      return {
        ...(await this.issueAccessToken(token.user_id, token.auth_session_id)),
        refreshToken: nextRawToken,
        refreshMaxAgeMs: this.refreshMaxAgeMs()
      };
    });
  }

  async logout(sessionId: string): Promise<GenericAuthResponse> {
    await this.dataSource.query(
      `UPDATE auth_sessions
       SET revoked_at = COALESCE(revoked_at, now()), revoke_reason = 'logout'
       WHERE id = $1`,
      [sessionId]
    );

    return { ok: true, message: 'Logged out.' };
  }

  async logoutAll(userId: string): Promise<GenericAuthResponse> {
    await this.dataSource.query(
      `UPDATE auth_sessions
       SET revoked_at = COALESCE(revoked_at, now()), revoke_reason = 'logout_all'
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );

    return { ok: true, message: 'All sessions logged out.' };
  }

  async assertSessionCanAccess(userId: string, sessionId: string): Promise<void> {
    const rows = await this.dataSource.query<{ id: string; status: UserAccountStatus }[]>(
      `SELECT auth_sessions.id, users.status
       FROM auth_sessions
       JOIN users ON users.id = auth_sessions.user_id
       WHERE auth_sessions.id = $1
         AND auth_sessions.user_id = $2
         AND auth_sessions.revoked_at IS NULL
         AND auth_sessions.expires_at > now()`,
      [sessionId, userId]
    );
    const row = rows[0];

    if (!row) {
      throw new DomainError('SESSION_INVALID', 'Session is invalid.', 401);
    }

    this.assertUserStatusCanAuthenticate(row.status);
  }

  async verifyEmail(rawToken: string): Promise<GenericAuthResponse> {
    const tokenHash = this.tokenHash.hash(rawToken);

    await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<
        {
          id: string;
          user_id: string;
          expires_at: Date;
          consumed_at: Date | null;
        }[]
      >(
        `SELECT id, user_id, expires_at, consumed_at
         FROM email_verification_tokens
         WHERE token_hash = $1
         FOR UPDATE`,
        [tokenHash]
      );
      const token = rows[0];

      if (!token || token.consumed_at || token.expires_at <= new Date()) {
        throw new DomainError('INVALID_VERIFICATION_TOKEN', 'Verification link is invalid or expired.', 400);
      }

      await manager.query(`UPDATE email_verification_tokens SET consumed_at = now() WHERE id = $1`, [token.id]);
      await manager.query(
        `UPDATE users
         SET status = 'ACTIVE', email_verified_at = COALESCE(email_verified_at, now()), updated_at = now(), lock_version = lock_version + 1
         WHERE id = $1 AND status = 'PENDING_VERIFICATION'`,
        [token.user_id]
      );
    });

    return {
      ok: true,
      message: 'Email verified.'
    };
  }

  async resendVerification(email: string, ipKey: string): Promise<GenericAuthResponse> {
    this.rateLimiter.consume(`resend-verification:ip:${ipKey}`, 10, 60 * 60 * 1000);
    this.rateLimiter.consume(`resend-verification:email:${email}`, 5, 60 * 60 * 1000);

    const rawToken = this.tokenHash.generateRawToken();
    const tokenHash = this.tokenHash.hash(rawToken);
    const verificationTtlHours = this.config.get<number>('EMAIL_VERIFICATION_TTL_HOURS', 24);
    let shouldSend = false;

    await this.dataSource.transaction(async (manager) => {
      const users = await manager.query<{ id: string; status: UserAccountStatus }[]>(
        `SELECT id, status FROM users WHERE email = $1 FOR UPDATE`,
        [email]
      );
      const user = users[0];

      if (!user || user.status !== UserAccountStatus.PendingVerification) {
        return;
      }

      await manager.query(
        `UPDATE email_verification_tokens
         SET consumed_at = now()
         WHERE user_id = $1 AND consumed_at IS NULL`,
        [user.id]
      );
      await manager.query(
        `INSERT INTO email_verification_tokens (user_id, token_hash, email_snapshot, expires_at)
         VALUES ($1, $2, $3, now() + ($4 || ' hours')::interval)`,
        [user.id, tokenHash, email, verificationTtlHours]
      );
      shouldSend = true;
    });

    if (shouldSend) {
      await this.email.sendVerificationEmail(email, rawToken);
    }

    return this.genericVerificationResponse();
  }

  async forgotPassword(email: string, ipKey: string): Promise<GenericAuthResponse> {
    this.rateLimiter.consume(`forgot-password:ip:${ipKey}`, 10, 60 * 60 * 1000);
    this.rateLimiter.consume(`forgot-password:email:${email}`, 5, 60 * 60 * 1000);

    const rawToken = this.tokenHash.generateRawToken();
    const resetHash = this.tokenHash.hash(rawToken);
    const resetTtlMinutes = this.config.get<number>('PASSWORD_RESET_TTL_MINUTES', 30);
    let shouldSend = false;

    await this.dataSource.transaction(async (manager) => {
      const users = await manager.query<{ id: string; status: UserAccountStatus }[]>(
        `SELECT id, status FROM users WHERE email = $1 FOR UPDATE`,
        [email]
      );
      const user = users[0];

      if (!user || user.status === UserAccountStatus.Deleted || user.status === UserAccountStatus.Suspended) {
        return;
      }

      await manager.query(
        `UPDATE password_reset_tokens
         SET consumed_at = now()
         WHERE user_id = $1 AND consumed_at IS NULL`,
        [user.id]
      );
      await manager.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
        [user.id, resetHash, resetTtlMinutes]
      );
      shouldSend = true;
    });

    if (shouldSend) {
      await this.email.sendPasswordResetEmail(email, rawToken);
    }

    return this.genericPasswordResetResponse();
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<GenericAuthResponse> {
    this.passwordPolicy.assertAcceptable(newPassword);
    const resetHash = this.tokenHash.hash(rawToken);
    const passwordHash = await this.hashPassword(newPassword);

    await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<
        { id: string; user_id: string; expires_at: Date; consumed_at: Date | null }[]
      >(
        `SELECT id, user_id, expires_at, consumed_at
         FROM password_reset_tokens
         WHERE token_hash = $1
         FOR UPDATE`,
        [resetHash]
      );
      const token = rows[0];

      if (!token || token.consumed_at || token.expires_at <= new Date()) {
        throw new DomainError('INVALID_PASSWORD_RESET_TOKEN', 'Password reset link is invalid or expired.', 400);
      }

      await manager.query(
        `UPDATE user_credentials
         SET password_hash = $2, password_algorithm = 'argon2id', password_changed_at = now(), updated_at = now(), failed_login_attempts = 0, locked_until = NULL
         WHERE user_id = $1`,
        [token.user_id, passwordHash]
      );
      await manager.query(`UPDATE password_reset_tokens SET consumed_at = now() WHERE id = $1`, [token.id]);
      await manager.query(
        `UPDATE auth_sessions
         SET revoked_at = COALESCE(revoked_at, now()), revoke_reason = 'password_reset'
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [token.user_id]
      );
    });

    return { ok: true, message: 'Password was reset.' };
  }

  async changePassword(userId: string, currentSessionId: string, dto: ChangePasswordDto): Promise<GenericAuthResponse> {
    this.passwordPolicy.assertAcceptable(dto.newPassword);

    const credentialRows = await this.dataSource.query<{ password_hash: string }[]>(
      `SELECT password_hash FROM user_credentials WHERE user_id = $1`,
      [userId]
    );
    const credential = credentialRows[0];

    if (!credential || !(await argonVerify(credential.password_hash, dto.currentPassword))) {
      throw new DomainError('INVALID_CURRENT_PASSWORD', 'Current password is incorrect.', 401);
    }

    const passwordHash = await this.hashPassword(dto.newPassword);

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE user_credentials
         SET password_hash = $2, password_algorithm = 'argon2id', password_changed_at = now(), updated_at = now(), failed_login_attempts = 0, locked_until = NULL
         WHERE user_id = $1`,
        [userId, passwordHash]
      );
      await manager.query(
        `UPDATE auth_sessions
         SET revoked_at = COALESCE(revoked_at, now()), revoke_reason = 'password_changed'
         WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`,
        [userId, currentSessionId]
      );
    });

    return { ok: true, message: 'Password changed.' };
  }

  async listSessions(userId: string, currentSessionId: string): Promise<SafeSession[]> {
    const rows = await this.dataSource.query<
      {
        id: string;
        device_name: string | null;
        user_agent: string | null;
        created_at: Date;
        last_used_at: Date;
        expires_at: Date;
        revoked_at: Date | null;
      }[]
    >(
      `SELECT id, device_name, user_agent, created_at, last_used_at, expires_at, revoked_at
       FROM auth_sessions
       WHERE user_id = $1
       ORDER BY last_used_at DESC`,
      [userId]
    );

    return rows.map((row) => ({
      id: row.id,
      deviceName: row.device_name,
      userAgent: row.user_agent,
      createdAt: row.created_at.toISOString(),
      lastUsedAt: row.last_used_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
      current: row.id === currentSessionId
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<GenericAuthResponse> {
    const result = await this.dataSource.query<{ id: string }[]>(
      `UPDATE auth_sessions
       SET revoked_at = COALESCE(revoked_at, now()), revoke_reason = 'user_revoked'
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [sessionId, userId]
    );

    if (!result[0]) {
      throw new DomainError('SESSION_NOT_FOUND', 'Session was not found.', 404);
    }

    return { ok: true, message: 'Session revoked.' };
  }

  private genericVerificationResponse(): GenericAuthResponse {
    return {
      ok: true,
      message: 'If the account can be created or verified, an email will be sent.'
    };
  }

  private genericPasswordResetResponse(): GenericAuthResponse {
    return {
      ok: true,
      message: 'If the account exists, password reset instructions will be sent.'
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof QueryFailedError && (error as QueryFailedError & { code?: string }).code === '23505';
  }

  private async createSession(
    userId: string,
    metadata: { userAgent?: string; deviceName?: string }
  ): Promise<AuthTokenResponse & { refreshToken: string; refreshMaxAgeMs: number }> {
    const refreshTtlDays = this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS');
    const rawRefreshToken = this.tokenHash.generateRawToken();
    const refreshHash = this.tokenHash.hash(rawRefreshToken);

    const sessionRows = await this.dataSource.query<{ id: string }[]>(
      `INSERT INTO auth_sessions (user_id, user_agent, device_name, expires_at)
       VALUES ($1, $2, $3, now() + ($4 || ' days')::interval)
       RETURNING id`,
      [userId, metadata.userAgent ?? null, metadata.deviceName ?? null, refreshTtlDays]
    );
    const sessionId = sessionRows[0]?.id as string;

    await this.dataSource.query(
      `INSERT INTO auth_refresh_tokens (auth_session_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
      [sessionId, refreshHash, refreshTtlDays]
    );

    await this.dataSource.query(`UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1`, [userId]);

    return {
      ...(await this.issueAccessToken(userId, sessionId)),
      refreshToken: rawRefreshToken,
      refreshMaxAgeMs: this.refreshMaxAgeMs()
    };
  }

  private hashPassword(password: string): Promise<string> {
    return argonHash(password, {
      type: 2,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1
    });
  }

  private async issueAccessToken(userId: string, sessionId: string): Promise<AuthTokenResponse> {
    return {
      accessToken: await this.accessTokens.sign({ sub: userId, sid: sessionId }),
      expiresIn: this.config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS')
    };
  }

  private refreshMaxAgeMs(): number {
    return this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS') * 24 * 60 * 60 * 1000;
  }

  private assertUserStatusCanAuthenticate(status: UserAccountStatus): void {
    if (status !== UserAccountStatus.Active) {
      throw new DomainError('USER_NOT_ACTIVE', 'This account is not active.', 403);
    }
  }
}
