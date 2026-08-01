import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { VisualDirectionsController } from './visual-directions.controller';
import { VisualDirectionsService } from './visual-directions.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [VisualDirectionsController],
  providers: [VisualDirectionsService],
  exports: [VisualDirectionsService]
})
export class VisualsModule {}
