import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

export enum VisualContentOrigin {
  Ai = 'AI',
  User = 'USER',
  Imported = 'IMPORTED'
}

class OrderedVisualItemDto {
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsEnum(VisualContentOrigin)
  @IsOptional()
  origin?: VisualContentOrigin = VisualContentOrigin.User;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class VisualColorDto extends OrderedVisualItemDto {
  @IsString()
  @MaxLength(80)
  tokenName!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  hex!: string;

  @IsString()
  @IsOptional()
  usage?: string;
}

export class VisualFontDto extends OrderedVisualItemDto {
  @IsString()
  role!: string;

  @IsString()
  @MaxLength(180)
  family!: string;

  @IsString()
  @MaxLength(180)
  fallback!: string;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  weights?: number[] = [400];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supportedScripts?: string[] = [];

  @IsString()
  @IsOptional()
  source?: string = 'SYSTEM';

  @IsString()
  @IsOptional()
  licenseStatus?: string = 'UNKNOWN';
}

export class CreateVisualDirectionDto {
  @IsUUID()
  identityVersionId!: string;

  @IsString()
  @MaxLength(180)
  name!: string;

  @IsString()
  @IsOptional()
  rationale?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  moodKeywords?: string[] = [];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imagery?: string[] = [];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  layoutNotes?: string[] = [];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VisualColorDto)
  @IsOptional()
  colors?: VisualColorDto[] = [];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VisualFontDto)
  @IsOptional()
  fonts?: VisualFontDto[] = [];
}

export class UpdateVisualDirectionDto extends CreateVisualDirectionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lockVersion!: number;
}

export class SelectVisualDirectionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lockVersion!: number;
}
