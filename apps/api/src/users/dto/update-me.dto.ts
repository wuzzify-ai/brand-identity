import { IsInt, IsOptional, IsString, IsUrl, Length, Matches, Min } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @Length(1, 180)
  displayName?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 35)
  @Matches(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, {
    message: 'preferredLocale must be a valid BCP-47-like locale.'
  })
  preferredLocale?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  timezone?: string;

  @IsInt()
  @Min(1)
  lockVersion!: number;
}
