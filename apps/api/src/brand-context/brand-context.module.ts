import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { BrandContextController } from './brand-context.controller';
import { BrandContextService } from './brand-context.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [BrandContextController],
  providers: [BrandContextService],
  exports: [BrandContextService]
})
export class BrandContextModule {}
