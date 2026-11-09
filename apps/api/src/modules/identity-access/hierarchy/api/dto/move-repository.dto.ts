import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class MoveRepositoryDto {
  @IsUUID()
  deliveryProjectId!: string;

  /**
   * True once the lead has seen who would lose GitHub Write by the move (the
   * 409 MOVE_REVOKES_ACCESS answer lists them) and agreed. Without it, a move
   * that would remove anyone's access is refused.
   */
  @IsOptional()
  @IsBoolean()
  confirmAccessChange?: boolean;
}
