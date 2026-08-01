import { Module } from '@nestjs/common';
import { AssetUrlSigner } from '../assets/storage/asset-url-signer.service';
import { PrivateAssetStorage } from '../assets/storage/private-asset-storage.service';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { BrandBookObjectsController } from './brand-book-objects.controller';
import { BrandBooksController } from './brand-books.controller';
import { BrandBooksService } from './brand-books.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [BrandBooksController, BrandBookObjectsController],
  providers: [BrandBooksService, PrivateAssetStorage, AssetUrlSigner]
})
export class BrandBooksModule {}
