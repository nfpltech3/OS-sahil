import { IsString, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsBoolean()
  is_team_lead?: boolean;
}
