import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';

export enum BriefContentOrigin {
  Ai = 'AI',
  User = 'USER',
  Imported = 'IMPORTED'
}

class OrderedBriefItemDto {
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsEnum(BriefContentOrigin)
  @IsOptional()
  origin?: BriefContentOrigin = BriefContentOrigin.User;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class BriefLanguageDto extends OrderedBriefItemDto {
  @IsString()
  @MaxLength(20)
  languageCode!: string;

  @IsString()
  @MaxLength(120)
  displayName!: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean = false;
}

export class NamedBriefItemDto extends OrderedBriefItemDto {
  @IsString()
  @MaxLength(180)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class BriefMarketDto extends OrderedBriefItemDto {
  @IsString()
  @MaxLength(180)
  name!: string;

  @IsString()
  @IsOptional()
  region?: string;
}

export class TextBriefItemDto extends OrderedBriefItemDto {
  @IsString()
  text!: string;
}

export class UpdateBriefDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lockVersion!: number;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  positioning?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BriefLanguageDto)
  @IsOptional()
  languages?: BriefLanguageDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NamedBriefItemDto)
  @IsOptional()
  audiences?: NamedBriefItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BriefMarketDto)
  @IsOptional()
  markets?: BriefMarketDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NamedBriefItemDto)
  @IsOptional()
  offerings?: NamedBriefItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TextBriefItemDto)
  @IsOptional()
  preferences?: TextBriefItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TextBriefItemDto)
  @IsOptional()
  constraints?: TextBriefItemDto[];
}

export class CompleteBriefDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lockVersion!: number;
}
