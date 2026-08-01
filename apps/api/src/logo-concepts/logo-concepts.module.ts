import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { LogoConceptsController } from './logo-concepts.controller';
import { LogoConceptsService } from './logo-concepts.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [LogoConceptsController],
  providers: [LogoConceptsService]
})
export class LogoConceptsModule {}
