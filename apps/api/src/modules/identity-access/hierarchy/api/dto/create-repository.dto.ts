import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateRepositoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/, { message: 'name must contain a non-whitespace character' })
  name: string = '';

  // Private only — enforced, not just defaulted (current hierarchy API contract).
  @IsIn(['private'])
  visibility = 'private' as const;
}
