import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { IdentityProjectsController } from './identity-projects.controller';
import { IdentityProjectsService } from './identity-projects.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [IdentityProjectsController],
  providers: [IdentityProjectsService],
  exports: [IdentityProjectsService]
})
export class IdentityProjectsModule {}
