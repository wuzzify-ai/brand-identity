import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateLogoConceptDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lockVersion!: number;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  productionNotes?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class LogoConceptActionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lockVersion!: number;
}
