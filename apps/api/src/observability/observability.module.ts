import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [UsageController],
  providers: [UsageService]
})
export class ObservabilityModule {}
