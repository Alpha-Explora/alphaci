import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { ReleaseRegistryService } from '../application/release-registry.service';
import { OnpremCertificatesService } from '../application/onprem/onprem-certificates.service';
import { ReportDeploymentStatusDto } from './dto/release-registry.dto';
import { OnpremMachineRateLimit } from './onprem-machine-throttler.guard';
import { CapabilityGuard, RequiresCapability } from '#kernel/composition/index';

/**
 * The surface an on-prem host agent polls, outbound only. Authenticated by a
 * host token scoped to one environment. Composition is checked separately
 * from the machine credential; session authentication does not apply.
 */
@Controller('onprem')
@UseGuards(CapabilityGuard)
@RequiresCapability('runtime.managed-host-delivery')
export class OnpremAgentController {
  constructor(
    private readonly releases: ReleaseRegistryService,
    private readonly certificates: OnpremCertificatesService,
  ) {}

  @Get('assignments')
  @OnpremMachineRateLimit()
  assignments(@Headers('authorization') authorization: string | undefined) {
    return this.releases.hostAssignments(bearer(authorization));
  }

  /** The chain and key of a certificate one of the machine's bound addresses uses. */
  @Get('certificates/:certificateId')
  @OnpremMachineRateLimit()
  certificate(
    @Headers('authorization') authorization: string | undefined,
    @Param('certificateId', ParseUUIDPipe) certificateId: string,
  ) {
    return this.certificates.forMachine(bearer(authorization), certificateId);
  }

  @Post('deployments/:deploymentId/status')
  @OnpremMachineRateLimit()
  reportStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param('deploymentId', ParseUUIDPipe) deploymentId: string,
    @Body() body: ReportDeploymentStatusDto,
  ) {
    return this.releases.reportHostStatus(
      bearer(authorization),
      deploymentId,
      body.status,
      body.detail ?? null,
    );
  }
}

function bearer(authorization: string | undefined): string {
  const [scheme, value] = (authorization ?? '').split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value?.trim()) {
    throw new UnauthorizedException('A host token is required');
  }
  return value.trim();
}
