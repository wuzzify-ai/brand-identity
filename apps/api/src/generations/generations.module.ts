import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { GenerationQueueService } from './generation-queue.service';
import { GenerationsController } from './generations.controller';
import { GenerationsService } from './generations.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [GenerationsController],
  providers: [GenerationsService, GenerationQueueService],
  exports: [GenerationsService]
})
export class GenerationsModule {}
