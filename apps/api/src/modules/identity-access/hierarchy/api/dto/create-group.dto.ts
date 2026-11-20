import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/\S/, { message: 'name must contain a non-whitespace character' })
  name: string = '';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessUnit?: string;
}
