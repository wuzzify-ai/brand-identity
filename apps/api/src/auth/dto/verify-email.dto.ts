import { IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @Length(32, 256)
  token!: string;
}
