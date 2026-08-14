import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module';
import { validateApiEnv } from './config/api-env.schema';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { SecurityHeadersMiddleware } from './common/security-headers.middleware';
import { AuthDatabaseModule } from './auth/auth-database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { IdentityProjectsModule } from './identity-projects/identity-projects.module';
import { AiModule } from './ai/ai.module';
import { GenerationsModule } from './generations/generations.module';
import { BriefsModule } from './briefs/briefs.module';
import { StrategiesModule } from './strategies/strategies.module';
import { VisualsModule } from './visuals/visuals.module';
import { AssetsModule } from './assets/assets.module';
import { LogoConceptsModule } from './logo-concepts/logo-concepts.module';
import { DesignTokensModule } from './design-tokens/design-tokens.module';
import { BrandBooksModule } from './brand-books/brand-books.module';
import { BrandContextModule } from './brand-context/brand-context.module';
import { ApprovalModule } from './approval/approval.module';
import { AuditModule } from './audit/audit.module';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateApiEnv
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
        retryAttempts: 1,
        retryDelay: 1000
      })
    }),
    AuthDatabaseModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    IdentityProjectsModule,
    AiModule,
    GenerationsModule,
    BriefsModule,
    StrategiesModule,
    VisualsModule,
    AssetsModule,
    LogoConceptsModule,
    DesignTokensModule,
    BrandBooksModule,
    BrandContextModule,
    ApprovalModule,
    AuditModule,
    ObservabilityModule,
    HealthModule
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityHeadersMiddleware, RequestIdMiddleware).forRoutes('*');
  }
}
