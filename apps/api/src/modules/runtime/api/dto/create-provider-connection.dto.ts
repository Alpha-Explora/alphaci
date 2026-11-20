import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import type { EnvProvider } from '../../core/deployments.types';

/** Body of POST /provider-connections. The token is checked with the provider. */
export class CreateProviderConnectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  provider!: EnvProvider;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  token!: string;

  @IsOptional() @IsString() @MaxLength(200) vercelTeamId?: string;
  @IsOptional() @IsString() @MaxLength(200) vercelTeamSlug?: string;
}
