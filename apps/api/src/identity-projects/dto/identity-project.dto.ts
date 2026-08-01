import { IsInt, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator';

export class CreateIdentityProjectDto {
  @IsString()
  @Length(1, 180)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(3, 200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @IsOptional()
  @IsUUID()
  parentProjectId?: string;

  @IsOptional()
  @IsString()
  initialDescription?: string;
}

export class UpdateIdentityProjectDto {
  @IsOptional()
  @IsString()
  @Length(1, 180)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(3, 200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @IsInt()
  @Min(1)
  lockVersion!: number;
}

export class CloneIdentityVersionDto {
  @IsUUID()
  sourceVersionId!: string;
}
