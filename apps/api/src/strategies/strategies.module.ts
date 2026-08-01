import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { StrategiesController } from './strategies.controller';
import { StrategiesService } from './strategies.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [StrategiesController],
  providers: [StrategiesService],
  exports: [StrategiesService]
})
export class StrategiesModule {}
