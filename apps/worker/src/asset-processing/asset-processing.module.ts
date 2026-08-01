import { Module } from '@nestjs/common';
import { AssetObjectStorage } from './asset-object-storage.js';
import { AssetProcessingService } from './asset-processing.service.js';

@Module({
  providers: [AssetObjectStorage, AssetProcessingService]
})
export class AssetProcessingModule {}
