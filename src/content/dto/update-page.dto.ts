import { IsString, IsOptional, IsArray, IsDateString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BlockDto } from './block.dto';

export class UpdatePageDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockDto)
  @IsOptional()
  blocks?: BlockDto[];
}
