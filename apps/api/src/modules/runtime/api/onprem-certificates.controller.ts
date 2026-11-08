import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '#kernel/auth/session-auth.guard';
import { SubscriptionGuard } from '#kernel/auth/subscription.guard';
import { CapabilityGuard } from '#kernel/composition/capability.guard';
import { RequiresCapability } from '#kernel/composition/requires-capability.decorator';
import {
  OnpremCertificatesService,
  type CertificateUploadInput,
} from '../application/onprem/onprem-certificates.service';
import { UploadCertificateDto } from './dto/onprem-host.dto';

/** A workspace's certificates for bound addresses (the IIS certificate store). */
@Controller('workspaces/:workspaceId/onprem-certificates')
@RequiresCapability('runtime.managed-host-delivery')
@UseGuards(SessionAuthGuard, CapabilityGuard, SubscriptionGuard)
export class OnpremCertificatesController {
  constructor(private readonly certificates: OnpremCertificatesService) {}
  @Get()
  list(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() req: Request,
  ) {
    return this.certificates.list(workspaceId, req.session.user!.id);
  }
  @Post()
  upload(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() req: Request,
    @Body() body: UploadCertificateDto,
  ) {
    return this.certificates.upload(
      workspaceId,
      req.session.user!.id,
      uploadInput(body),
    );
  }
  @Delete(':certificateId')
  @HttpCode(204)
  async remove(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('certificateId', ParseUUIDPipe) certificateId: string,
    @Req() req: Request,
  ) {
    await this.certificates.remove(
      workspaceId,
      req.session.user!.id,
      certificateId,
    );
  }
}

/** Exactly one form: a .pfx with its password, or a PEM chain and key. */
export function uploadInput(
  body: UploadCertificateDto,
): CertificateUploadInput {
  const pfx = body.pfxBase64 !== undefined;
  const pem =
    body.certificatePem !== undefined || body.privateKeyPem !== undefined;
  if (pfx && !pem)
    return {
      name: body.name,
      pfxBase64: body.pfxBase64!,
      password: body.password ?? '',
    };
  if (pem && !pfx && body.certificatePem && body.privateKeyPem)
    return {
      name: body.name,
      certificatePem: body.certificatePem,
      privateKeyPem: body.privateKeyPem,
    };
  throw new BadRequestException(
    'Upload either a .pfx file with its password, or a PEM certificate with its private key.',
  );
}
