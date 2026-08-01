import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { AnonymousUploadStatusDto, CompleteAnonymousUploadDto, CreateAnonymousUploadGrantDto } from './dto/public-asset.dto';

@ApiTags('public-assets')
@Controller('public/brand-assets/:publicSlug')
export class PublicAssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  list(@Param('publicSlug') publicSlug: string) {
    return this.assets.listPublicAssets(publicSlug);
  }

  @Post('anonymous-upload-grants')
  createGrant(
    @Param('publicSlug') publicSlug: string,
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Headers('x-real-ip') realIp: string | undefined,
    @Body() body: CreateAnonymousUploadGrantDto
  ) {
    return this.assets.createAnonymousUploadGrant(publicSlug, clientIp(forwardedFor, realIp), body);
  }

  @Post('anonymous-upload-complete')
  complete(@Param('publicSlug') publicSlug: string, @Body() body: CompleteAnonymousUploadDto) {
    return this.assets.completeAnonymousUpload(publicSlug, body);
  }

  @Post('anonymous-upload-status/:grantId')
  status(@Param('publicSlug') publicSlug: string, @Param('grantId') grantId: string, @Body() body: AnonymousUploadStatusDto) {
    return this.assets.getAnonymousUploadStatus(publicSlug, grantId, body.secret);
  }
}

function clientIp(forwardedFor: string | undefined, realIp: string | undefined): string {
  return forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
}
