import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
export class CreateEnrollmentDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsIn(['windows', 'ubuntu']) platform!: 'windows' | 'ubuntu';
  @IsUUID() requestId!: string;
  @IsOptional() @IsUUID() replacesMachineId?: string;
}
export class HostCheckDto {
  @Matches(/^[a-z0-9-]{1,60}$/) id!: string;
  @IsIn(['passed', 'failed', 'unverified']) status!:
    'passed' | 'failed' | 'unverified';
  @IsString() @MaxLength(300) message!: string;
}
export class MachineCheckInDto {
  @IsString() @MinLength(1) @MaxLength(80) agentVersion!: string;
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => HostCheckDto)
  checks!: HostCheckDto[];
}
export class HeartbeatDto extends MachineCheckInDto {
  /**
   * Tunnel reports, validated one by one by the service: an invalid entry is
   * recorded as a failed tunnel, so it must not fail the whole check-in.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  tunnels?: unknown[];
  /** Bound-address reports, validated one by one like the tunnel reports. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  bindings?: unknown[];
}
export class ConsumeEnrollmentDto extends MachineCheckInDto {
  @Matches(/^[A-Za-z0-9_-]{43}$/) code!: string;
}
export class RevokeMachineDto {
  /** An active machine of the same workspace that takes over the environments. */
  @IsOptional() @IsUUID() replacementMachineId?: string;
}
/**
 * A certificate for bound addresses: a .pfx export with its password, or a
 * PEM chain and key. The service checks that exactly one form is complete.
 */
export class UploadCertificateDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(90_000) pfxBase64?: string;
  @IsOptional() @IsString() @MaxLength(1024) password?: string;
  @IsOptional() @IsString() @MaxLength(65_536) certificatePem?: string;
  @IsOptional() @IsString() @MaxLength(65_536) privateKeyPem?: string;
}
