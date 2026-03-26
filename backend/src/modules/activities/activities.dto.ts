import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateActivityDto {
  @IsString()
  @IsIn(['run', 'walk', 'ride'])
  sport!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  // ISO date string
  @IsString()
  startedAt!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365 * 24 * 60 * 60)
  durationSeconds!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  distanceMeters!: number;

  @IsOptional()
  @IsString()
  @IsIn(['public', 'followers', 'only_me'])
  visibility?: string;

}
