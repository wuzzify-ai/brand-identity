import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { BrandAssetCategory } from '../../database/entities';

export class CreateAnonymousUploadGrantDto {
  @IsEnum(BrandAssetCategory)
  category!: BrandAssetCategory;

  @IsString()
  @MaxLength(255)
  filename!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100 * 1024 * 1024)
  byteSize!: number;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  altText?: string;

  @IsString()
  @MaxLength(200)
  botChallenge!: string;
}

export class CompleteAnonymousUploadDto {
  @IsUUID()
  grantId!: string;

  @IsString()
  @MaxLength(200)
  secret!: string;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  @IsOptional()
  checksumSha256?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100 * 1024 * 1024)
  @IsOptional()
  byteSize?: number;
}

export class AnonymousUploadStatusDto {
  @IsString()
  @MaxLength(200)
  secret!: string;
}

export class PublishAssetDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lockVersion!: number;
}
