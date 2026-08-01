import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuthIdentityEntity,
  AuthRefreshTokenEntity,
  AuthSessionEntity,
  EmailVerificationTokenEntity,
  PasswordResetTokenEntity,
  UserCredentialEntity,
  UserEntity,
  WorkspaceEntity,
  WorkspaceInvitationEntity,
  WorkspaceMembershipEntity
} from '../database/entities';
import { AuthQueriesRepository } from './repositories/auth-queries.repository';
import { WorkspaceQueriesRepository } from './repositories/workspace-queries.repository';

const authWorkspaceEntities = [
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

@Module({
  imports: [TypeOrmModule.forFeature(authWorkspaceEntities)],
  providers: [AuthQueriesRepository, WorkspaceQueriesRepository],
  exports: [TypeOrmModule, AuthQueriesRepository, WorkspaceQueriesRepository]
})
export class AuthDatabaseModule {}
