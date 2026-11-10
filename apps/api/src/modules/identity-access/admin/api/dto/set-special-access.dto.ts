import { ArrayUnique, IsArray, IsIn } from 'class-validator';

import {
  SPECIAL_ACCESS,
  type SpecialAccess,
} from '#kernel/rules/special-access.rules';

export class SetSpecialAccessDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(SPECIAL_ACCESS, { each: true })
  access!: SpecialAccess[];
}
