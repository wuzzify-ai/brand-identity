import { IsEmail, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';
import { WorkspaceRole } from '../../database/entities';

export class CreateWorkspaceDto {
  @IsString()
  @Length(1, 180)
  name!: string;

  @IsString()
  @Length(3, 200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
}

export class UpdateWorkspaceDto {
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

export class InviteWorkspaceMemberDto {
  @IsEmail()
  @Length(3, 320)
  email!: string;

  @IsString()
  @Matches(/^(EDITOR|REVIEWER|VIEWER)$/)
  role!: Exclude<WorkspaceRole, WorkspaceRole.Owner>;
}

export class UpdateWorkspaceMemberDto {
  @IsString()
  @Matches(/^(OWNER|EDITOR|REVIEWER|VIEWER)$/)
  role!: WorkspaceRole;
}

export class AcceptWorkspaceInvitationDto {
  @IsString()
  @Length(32, 256)
  token!: string;
}
