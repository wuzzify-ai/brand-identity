import { IsString, Length } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @Length(32, 256)
  token!: string;

  @IsString()
  @Length(8, 256)
  newPassword!: string;
}
