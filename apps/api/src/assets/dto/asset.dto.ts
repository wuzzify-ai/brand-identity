import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { BrandAssetCategory } from '../../database/entities';

export class CreateAssetUploadDto {
  @IsUUID()
  identityVersionId!: string;

  @IsUUID()
  @IsOptional()
  visualDirectionId?: string;

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
  @Matches(/^[a-f0-9]{64}$/)
  @IsOptional()
  checksumSha256?: string;

  @IsString()
  @MaxLength(180)
  @IsOptional()
  displayName?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  altText?: string;
}

export class CompleteAssetUploadDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  @IsOptional()
  checksumSha256?: string;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  mimeType?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100 * 1024 * 1024)
  @IsOptional()
  byteSize?: number;
}

export class UpdateAssetDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lockVersion!: number;

  @IsString()
  @MaxLength(180)
  @IsOptional()
  displayName?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  altText?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
