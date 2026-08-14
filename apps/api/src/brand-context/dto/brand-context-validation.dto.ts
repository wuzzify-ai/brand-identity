import { IsArray, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class BrandContextValidationDto {
  @IsString()
  @MaxLength(50_000)
  @IsOptional()
  content?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  colors?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fonts?: string[];

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  assetIds?: string[];

  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  @IsOptional()
  brandContextPackageChecksumSha256?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
