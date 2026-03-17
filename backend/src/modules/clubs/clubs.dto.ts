import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

function toBool(value: unknown): boolean | unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'off'].includes(s)) return false;
  return value;
}

export class CreateClubDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  location!: string;

  @IsString()
  @IsIn(['run', 'walk', 'hike', 'cycle'])
  sport!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(800)
  description!: string;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  isInviteOnly?: boolean;
}

export class InviteUserDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

export class UpdateClubDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsString()
  @IsIn(['run', 'walk', 'hike', 'cycle'])
  sport?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(800)
  description?: string;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  isInviteOnly?: boolean;
}

export class SetMemberRoleDto {
  @IsString()
  @IsIn(['admin', 'member'])
  role!: string;
}

export class DeleteClubDto {
  @IsString()
  @IsNotEmpty()
  confirm!: string;
}

export class CreateClubPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;
}
