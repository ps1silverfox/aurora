import { IsString, IsOptional, IsArray, IsDateString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BlockDto } from './block.dto';

export class CreatePageDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  authorId?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockDto)
  @IsOptional()
  blocks?: BlockDto[];
}
