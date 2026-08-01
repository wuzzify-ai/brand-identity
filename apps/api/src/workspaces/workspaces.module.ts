import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceMembershipGuard } from './guards/workspace-membership.guard';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [AuthModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceMembershipGuard],
  exports: [WorkspacesService, WorkspaceMembershipGuard]
})
export class WorkspacesModule {}
