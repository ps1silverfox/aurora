import { IsString, IsIn } from 'class-validator';

export class TransitionDto {
  @IsString()
  @IsIn(['submit', 'approve', 'publish', 'archive'])
  action!: 'submit' | 'approve' | 'publish' | 'archive';
}
