import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BrandContextModule } from '../brand-context/brand-context.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';

@Module({
  imports: [AuthModule, BrandContextModule, WorkspacesModule],
  controllers: [ApprovalController],
  providers: [ApprovalService]
})
export class ApprovalModule {}
