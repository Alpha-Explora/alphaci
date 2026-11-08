import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WORKSPACE_ACCESS_PORT,
  type WorkspaceAccessPort,
} from '#kernel/ports/workspaces.port';
import {
  APP_ROLE_LOOKUP,
  type AppRoleLookup,
} from '#kernel/ports/app-role.port';
import { canManageHosting } from '#kernel/rules/persona-access.rules';
import { EnvTokenEncryptionService } from '../encryption.service';
import {
  OnpremCertificatesRepository,
  type OnpremCertificate,
} from '../../infrastructure/repositories/onprem-certificates.repository';
import { OnpremMachinesRepository } from '../../infrastructure/repositories/onprem-machines.repository';
import {
  parseCertificateUpload,
  type CertificateUpload,
} from './onprem-certificate-parser';
import {
  MACHINE_TOKEN_PREFIX,
  hashMachineSecret,
} from './onprem-hosts.service';
import type { MachineCertificate } from './onprem-host.contracts';

export type CertificateUploadInput = { name: string } & CertificateUpload;

/**
 * Certificates a workspace uploads for bound addresses (the .pfx an IIS
 * admin exports). The private key is encrypted at rest and only handed to a
 * machine that serves an address using it.
 */
@Injectable()
export class OnpremCertificatesService {
  constructor(
    private readonly certificates: OnpremCertificatesRepository,
    private readonly machines: OnpremMachinesRepository,
    private readonly encryption: EnvTokenEncryptionService,
    @Inject(WORKSPACE_ACCESS_PORT) private readonly access: WorkspaceAccessPort,
    @Inject(APP_ROLE_LOOKUP) private readonly roles: AppRoleLookup,
    private readonly config: ConfigService,
  ) {}

  async list(workspaceId: string, userId: string) {
    this.enabled();
    await this.access.assertWorkspaceRole(workspaceId, userId, [
      'admin',
      'delegated_lead',
      'member',
      'viewer',
    ]);
    return this.certificates.list(workspaceId);
  }

  async upload(
    workspaceId: string,
    userId: string,
    input: CertificateUploadInput,
  ): Promise<OnpremCertificate> {
    this.enabled();
    await this.assertManager(workspaceId, userId);
    const name = input.name?.trim();
    if (!name || name.length > 80)
      throw new BadRequestException(
        'Name the certificate (1 to 80 characters).',
      );
    const parsed = parseCertificateUpload(input);
    return this.certificates.create({
      workspaceId,
      userId,
      name,
      hostnames: parsed.hostnames,
      issuer: parsed.issuer,
      notBefore: parsed.notBefore,
      notAfter: parsed.notAfter,
      sha256: parsed.sha256,
      certificatePem: parsed.certificatePem,
      privateKeyCiphertext: this.encryption.encrypt(parsed.privateKeyPem),
    });
  }

  async remove(workspaceId: string, userId: string, id: string) {
    this.enabled();
    await this.assertManager(workspaceId, userId);
    if (!(await this.certificates.remove(workspaceId, id)))
      throw new NotFoundException('Certificate not found.');
  }

  /** The chain and key for a machine that serves an address using them. */
  async forMachine(
    credential: string,
    id: string,
  ): Promise<MachineCertificate> {
    this.enabled();
    if (!credential.startsWith(MACHINE_TOKEN_PREFIX))
      throw new UnauthorizedException('Machine credential is invalid.');
    const machineId = await this.machines.activeMachineId(
      hashMachineSecret(credential),
    );
    if (!machineId)
      throw new UnauthorizedException(
        'Machine credential is invalid or revoked.',
      );
    const found = await this.certificates.forMachine(machineId, id);
    if (!found)
      throw new NotFoundException(
        'No address on this machine uses that certificate.',
      );
    return {
      id,
      sha256: found.sha256,
      certificatePem: found.certificatePem,
      privateKeyPem: this.encryption.decrypt(found.privateKeyCiphertext),
    };
  }

  private async assertManager(workspaceId: string, userId: string) {
    await this.access.assertWorkspaceRole(workspaceId, userId, [
      'admin',
      'delegated_lead',
      'member',
    ]);
    if (!canManageHosting(await this.roles.findAppRole(userId)))
      throw new ForbiddenException(
        'Your application role cannot manage hosting.',
      );
  }

  private enabled() {
    if (this.config.get('ONPREM_RELEASES_ENABLED') !== 'true')
      throw new ForbiddenException('On-prem delivery is disabled.');
  }
}
