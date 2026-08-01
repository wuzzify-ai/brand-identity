import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AssetObjectsController } from './asset-objects.controller';
import { AssetProcessingQueueService } from './asset-processing-queue.service';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { PublicAssetsController } from './public-assets.controller';
import { AssetUrlSigner } from './storage/asset-url-signer.service';
import { PrivateAssetStorage } from './storage/private-asset-storage.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [AssetsController, AssetObjectsController, PublicAssetsController],
  providers: [AssetsService, AssetProcessingQueueService, AssetUrlSigner, PrivateAssetStorage],
  exports: [AssetsService]
})
export class AssetsModule {}
