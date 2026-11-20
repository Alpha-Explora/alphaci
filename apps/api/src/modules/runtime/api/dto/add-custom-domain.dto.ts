import type { AddCustomDomainRequest } from '@alphaci/api-contracts';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Body of POST /projects/:projectId/domains. The hostname is checked by the service. */
export class AddCustomDomainDto implements AddCustomDomainRequest {
  @IsUUID()
  deploymentTargetId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  hostname!: string;

  /** Pins the hostname to one branch. Omitted means the production domain. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  gitBranch?: string | null;
}
