import { IsEmail, Length } from 'class-validator';

export class ResendVerificationDto {
  @IsEmail()
  @Length(3, 320)
  email!: string;
}
