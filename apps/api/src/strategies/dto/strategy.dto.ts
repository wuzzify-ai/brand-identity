import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

export enum StrategyContentOrigin {
  Ai = 'AI',
  User = 'USER',
  Imported = 'IMPORTED'
}

class OrderedStrategyItemDto {
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsEnum(StrategyContentOrigin)
  @IsOptional()
  origin?: StrategyContentOrigin = StrategyContentOrigin.User;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class StrategyTextItemDto extends OrderedStrategyItemDto {
  @IsString()
  text!: string;

  @IsBoolean()
  @IsOptional()
  legalReviewRequired?: boolean = false;
}

export class StrategyTaglineDto extends StrategyTextItemDto {
  @IsString()
  @MaxLength(20)
  @IsOptional()
  languageCode?: string = 'en';

  @IsBoolean()
  @IsOptional()
  isSelected?: boolean = false;
}

export class StrategyPersonaDto extends OrderedStrategyItemDto {
  @IsString()
  @MaxLength(180)
  name!: string;

  @IsString()
  @IsOptional()
  segment?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  needs?: string[] = [];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pains?: string[] = [];
}

export class StrategyMessagingPillarDto extends OrderedStrategyItemDto {
  @IsString()
  @MaxLength(180)
  title!: string;

  @IsString()
  message!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  proofPoints?: string[] = [];
}

export class UpdateStrategyDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lockVersion!: number;

  @IsString()
  @IsOptional()
  positioning?: string;

  @IsString()
  @IsOptional()
  valueProposition?: string;

  @IsString()
  @IsOptional()
  mission?: string;

  @IsString()
  @IsOptional()
  vision?: string;

  @IsString()
  @IsOptional()
  essence?: string;

  @IsString()
  @IsOptional()
  promise?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StrategyTextItemDto)
  @IsOptional()
  values?: StrategyTextItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StrategyPersonaDto)
  @IsOptional()
  personas?: StrategyPersonaDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StrategyMessagingPillarDto)
  @IsOptional()
  messagingPillars?: StrategyMessagingPillarDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StrategyTaglineDto)
  @IsOptional()
  taglines?: StrategyTaglineDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StrategyTextItemDto)
  @IsOptional()
  rules?: StrategyTextItemDto[];
}

export class CompleteStrategyDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lockVersion!: number;
}
