import { IsBoolean, IsOptional } from 'class-validator';

/** Body of PATCH /notifications/preferences. */
export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;
}
