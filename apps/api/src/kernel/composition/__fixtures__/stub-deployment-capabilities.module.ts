import { Global, Module } from '@nestjs/common';

import {
  DEPLOYMENT_CAPABILITY_RESOLVER,
  type CapabilityResolverPort,
} from '../capability-resolver.port';

const noCapabilities: CapabilityResolverPort = {
  for: () => new Set(),
  deployment: () => new Set(),
};

/** Stands in for the global CompositionModule in runtime module specs. */
@Global()
@Module({
  providers: [
    { provide: DEPLOYMENT_CAPABILITY_RESOLVER, useValue: noCapabilities },
  ],
  exports: [DEPLOYMENT_CAPABILITY_RESOLVER],
})
export class StubDeploymentCapabilitiesModule {}
