import {
  DEPLOYMENT_CAPABILITY_RESOLVER,
  type CapabilityResolverPort,
} from '#kernel/composition/capability-resolver.port';
import { Controller, Get, Inject } from '@nestjs/common';

import type { DeploymentProvider } from '../core/deployment-provider.contract';
import { DeploymentProviderRegistry } from '../core/deployment-provider.registry';

@Controller('deployment-providers')
export class DeploymentProvidersController {
  constructor(
    @Inject(DEPLOYMENT_CAPABILITY_RESOLVER)
    private readonly capabilities: CapabilityResolverPort,
    private readonly providerRegistry: DeploymentProviderRegistry<DeploymentProvider>,
  ) {}

  @Get()
  list() {
    return {
      providers: this.providerRegistry.list().map((provider) => {
        const availability =
          provider.capabilities.connectivity === 'indirect' &&
          !this.capabilities.deployment().has('runtime.managed-host-delivery')
            ? {
                enabled: false,
                reason: 'Managed host delivery is not available',
              }
            : provider.isEnabled();

        return {
          id: provider.id,
          label: provider.label,
          enabled: availability.enabled,
          ...(availability.reason ? { reason: availability.reason } : {}),
          supportedSlots: [...provider.supportedSlots],
          capabilities: provider.capabilities,
          configSchema: provider.configSchema,
          credentialSchema: provider.credentialSchema,
        };
      }),
    };
  }
}
