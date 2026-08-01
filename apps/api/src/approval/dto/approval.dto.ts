import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApprovalReasonDto {
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  reason?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
