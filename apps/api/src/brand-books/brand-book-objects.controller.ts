import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { DomainError } from '../common/domain-error';
import { PrivateAssetStorage } from '../assets/storage/private-asset-storage.service';
import { BrandBooksService } from './brand-books.service';

@ApiTags('brand-book-objects')
@Controller('brand-book-download-objects')
export class BrandBookObjectsController {
  constructor(
    private readonly brandBooks: BrandBooksService,
    private readonly storage: PrivateAssetStorage
  ) {}

  @Get(':exportId')
  async download(@Param('exportId') exportId: string, @Query('token') token: string, @Res() response: Response) {
    if (!token) throw new DomainError('BRAND_BOOK_DOWNLOAD_TOKEN_REQUIRED', 'Download token is required.', 401);
    const exportRow = await this.brandBooks.resolveExportDownload(exportId, token);
    this.storage.streamObject(exportRow.object_key, response, exportRow.mime_type, `${exportRow.format.toLowerCase()}-${exportId}`);
  }
}
