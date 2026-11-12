import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ImportTestCaseRowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  category!: string;
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;
  @IsString()
  @MaxLength(2000)
  expectedResult!: string;
}

/** Additions only. Identical definitions are skipped; changed definitions require
 * the existing version-checked editor, never a title-based overwrite. */
export class ImportTestCasesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ImportTestCaseRowDto)
  rows!: ImportTestCaseRowDto[];
}
