import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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

export class PublicDeleteDto {
  @IsOptional()
  @IsString()
  confirm?: string;
}

export class PublicCreateActivityDto {
  @IsString()
  @IsIn(['run', 'walk', 'cycle', 'swim', 'hike', 'yoga'])
  sport!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsString()
  startedAt!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60 * 60 * 24 * 7)
  durationSeconds!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_000_000)
  distanceMeters!: number;

  @IsOptional()
  @IsString()
  @IsIn(['public', 'followers', 'only_me'])
  visibility?: string;
}

export class PublicUpdateActivityDto {
  @IsOptional()
  @IsString()
  @IsIn(['run', 'walk', 'cycle', 'swim', 'hike', 'yoga'])
  sport?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  startedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60 * 60 * 24 * 7)
  durationSeconds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_000_000)
  distanceMeters?: number;

  @IsOptional()
  @IsString()
  @IsIn(['public', 'followers', 'only_me'])
  visibility?: string;
}
