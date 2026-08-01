import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsObject, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { AiGenerationTier, GenerationTask, WorkflowStageKey } from '../../database/entities';

export class CreateGenerationDto {
  @IsUUID()
  workspaceId!: string;

  @IsUUID()
  identityVersionId!: string;

  @IsEnum(WorkflowStageKey)
  workflowStageKey!: WorkflowStageKey;

  @IsEnum(GenerationTask)
  task!: GenerationTask;

  @IsEnum(AiGenerationTier)
  @IsOptional()
  tier?: AiGenerationTier = AiGenerationTier.Balanced;

  @IsObject()
  @IsOptional()
  input?: Record<string, unknown> = {};

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  maxAttempts?: number = 2;
}
