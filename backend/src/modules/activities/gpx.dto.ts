import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ImportGpxDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(['public', 'followers', 'only_me'])
  visibility?: string;

  @IsOptional()
  @IsString()
  @IsIn(['run', 'walk', 'ride'])
  sport?: string;
}
