import { IsEmail, Length } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @Length(3, 320)
  email!: string;
}
