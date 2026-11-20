import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { QA_REQUIREMENT_DESCRIPTION_MAX_LENGTH } from '../qa-requirements.contracts';

export class UpdateRequirementDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(QA_REQUIREMENT_DESCRIPTION_MAX_LENGTH)
  description?: string | null;
}
