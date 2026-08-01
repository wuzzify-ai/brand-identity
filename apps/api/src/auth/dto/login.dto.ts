import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @Length(3, 320)
  email!: string;

  @IsString()
  @Length(1, 256)
  password!: string;

  @IsOptional()
  @IsString()
  @Length(1, 180)
  deviceName?: string;
}
