import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [ApprovalController],
  providers: [ApprovalService]
})
export class ApprovalModule {}
