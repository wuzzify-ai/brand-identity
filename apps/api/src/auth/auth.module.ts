import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthDatabaseModule } from './auth-database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessTokenService } from './access-token.service';
import { AuthEmailService } from './email/auth-email.service';
import { EmailDeliveryService, InMemoryEmailDeliveryService } from './email/email-delivery.service';
import { CurrentUserGuard } from './guards/current-user.guard';
import { PasswordPolicyService } from './password-policy.service';
import { InMemoryRateLimiterService } from './rate-limit/in-memory-rate-limiter.service';
import { AuthSessionRevocationService } from './services/auth-session-revocation.service';
import { TokenHashService } from './token-hash.service';

@Module({
  imports: [AuthDatabaseModule, ConfigModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessTokenService,
    PasswordPolicyService,
    TokenHashService,
    AuthEmailService,
    AuthSessionRevocationService,
    CurrentUserGuard,
    InMemoryRateLimiterService,
    {
      provide: EmailDeliveryService,
      useClass: InMemoryEmailDeliveryService
    }
  ],
  exports: [
    AuthService,
    AccessTokenService,
    PasswordPolicyService,
    TokenHashService,
    AuthEmailService,
    AuthSessionRevocationService,
    CurrentUserGuard
  ]
})
export class AuthModule {}
