import { IsString, IsInt, Min, IsObject } from 'class-validator';

export class BlockDto {
  @IsString()
  blockType!: string;

  @IsInt()
  @Min(0)
  blockOrder!: number;

  @IsObject()
  content!: Record<string, unknown>;
}
