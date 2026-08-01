import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { DesignTokensController } from './design-tokens.controller';
import { DesignTokensService } from './design-tokens.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [DesignTokensController],
  providers: [DesignTokensService]
})
export class DesignTokensModule {}
