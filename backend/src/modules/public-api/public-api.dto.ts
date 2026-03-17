import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class PublicListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}

export class PublicActivitiesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  since?: string;
}

export class PublicCreateClubDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(160)
  location!: string;

  @IsString()
  @IsIn(['run', 'walk', 'hike', 'cycle'])
  sport!: string;

  @IsString()
  @MaxLength(800)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  bannerUrl?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    const s = String(value ?? '').trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(s)) return true;
    if (['false', '0', 'no', 'off'].includes(s)) return false;
    return value;
  })
  isInviteOnly?: boolean;
}

export class PublicUpdateClubDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsString()
  @IsIn(['run', 'walk', 'hike', 'cycle'])
  sport?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  bannerUrl?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    const s = String(value ?? '').trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(s)) return true;
    if (['false', '0', 'no', 'off'].includes(s)) return false;
    return value;
  })
  isInviteOnly?: boolean;
}

export class PublicDeleteDto {
  @IsOptional()
  @IsString()
  confirm?: string;
}

export class PublicGetClubDto {
  @IsUUID()
  id!: string;
}
