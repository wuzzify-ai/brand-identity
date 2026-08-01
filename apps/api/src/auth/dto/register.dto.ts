import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @Length(3, 320)
  email!: string;

  @IsString()
  @Length(1, 180)
  displayName!: string;

  @IsString()
  @Length(8, 256)
  password!: string;

  @IsString()
  @Length(1, 180)
  workspaceName!: string;

  @IsString()
  @Length(3, 200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'workspaceSlug must contain lowercase letters, numbers, and single hyphens.'
  })
  workspaceSlug!: string;
}
