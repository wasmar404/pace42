import { IsIn, IsOptional, IsString } from 'class-validator';

export class ImportGpxDto {
  @IsOptional()
  @IsString()
  title?: string;

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
