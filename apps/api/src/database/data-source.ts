import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import {
  AuthIdentityEntity,
  AuthRefreshTokenEntity,
  AuthSessionEntity,
  AnonymousUploadGrantEntity,
  AssetVariantEntity,
  BrandAssetEntity,
  EmailVerificationTokenEntity,
  IdentityProjectEntity,
  IdentityVersionEntity,
  PasswordResetTokenEntity,
  UserCredentialEntity,
  UserEntity,
  WorkflowStageEntity,
  WorkspaceEntity,
  WorkspaceInvitationEntity,
  WorkspaceMembershipEntity
} from './entities';

function loadNearestEnvFile(): void {
  let currentDir = process.cwd();

  while (dirname(currentDir) !== currentDir) {
    const envPath = resolve(currentDir, '.env');

    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, 'utf8');

      for (const rawLine of envContent.split(/\r?\n/)) {
        const line = rawLine.trim();

        if (!line || line.startsWith('#')) {
          continue;
        }

        const separatorIndex = line.indexOf('=');

        if (separatorIndex === -1) {
          continue;
        }

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

        if (key && process.env[key] === undefined) {
          process.env[key] = value;
        }
      }

      return;
    }

    currentDir = dirname(currentDir);
  }
}

loadNearestEnvFile();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run TypeORM commands.');
}

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  synchronize: false,
  migrationsRun: false,
  migrationsTransactionMode: 'each',
  entities: [
    UserEntity,
    UserCredentialEntity,
    AuthIdentityEntity,
    AuthSessionEntity,
    AuthRefreshTokenEntity,
    EmailVerificationTokenEntity,
    PasswordResetTokenEntity,
    WorkspaceEntity,
    WorkspaceMembershipEntity,
    WorkspaceInvitationEntity,
    IdentityProjectEntity,
    IdentityVersionEntity,
    WorkflowStageEntity,
    BrandAssetEntity,
    AssetVariantEntity,
    AnonymousUploadGrantEntity
  ],
  migrations: [`${__dirname}/migrations/*{.ts,.js}`]
});
