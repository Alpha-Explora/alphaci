import type { DeploymentProvider } from '../core/deployment-provider.contract';
import { DeploymentProviderRegistry } from '../core/deployment-provider.registry';
import { DeploymentProvidersController } from './deployment-providers.controller';

describe('DeploymentProvidersController', () => {
  it('lists provider metadata and enabled state without credentials', () => {
    const provider: DeploymentProvider = {
      id: 'gcp',
      label: 'Google Cloud Platform',
      supportedSlots: ['backend', 'frontend'],
      capabilities: {
        envVars: true,
        logs: true,
        deployHistory: true,
        teardown: true,
        managedMode: true,
        liveStatus: true,
        connectivity: 'direct',
        enumerable: false,
        credentialCustody: 'platform',
      },
      configSchema: {
        fields: [{ key: 'projectId', label: 'Project ID', required: true }],
      },
      credentialSchema: { fields: [] },
      isEnabled: () => ({
        enabled: false,
        reason: 'GCP deployments are disabled',
      }),
      validateConfig: jest.fn(),
    };
    const registry = new DeploymentProviderRegistry<DeploymentProvider>();
    registry.register(provider);
    const hostRegistry = new DeploymentProviderRegistry<DeploymentProvider>();
    hostRegistry.register(provider);
    hostRegistry.register({
      ...provider,
      id: 'onprem-compose',
      capabilities: { ...provider.capabilities, connectivity: 'indirect' },
      isEnabled: () => ({ enabled: true }),
    });
    const denied = new DeploymentProvidersController(
      { deployment: () => new Set(), for: () => new Set() },
      hostRegistry,
    ).list();
    expect(
      denied.providers.find(({ id }) => id === 'onprem-compose'),
    ).toMatchObject({
      enabled: false,
      reason: 'Managed host delivery is not available',
    });
    expect(denied.providers.find(({ id }) => id === 'gcp')).toMatchObject({
      enabled: false,
      reason: 'GCP deployments are disabled',
    });
    const controller = new DeploymentProvidersController(
      {
        deployment: () => new Set(['runtime.managed-host-delivery']),
        for: () => new Set(['runtime.managed-host-delivery']),
      },
      registry,
    );

    expect(controller.list()).toEqual({
      providers: [
        {
          id: 'gcp',
          label: 'Google Cloud Platform',
          enabled: false,
          reason: 'GCP deployments are disabled',
          supportedSlots: ['backend', 'frontend'],
          capabilities: provider.capabilities,
          configSchema: provider.configSchema,
          credentialSchema: provider.credentialSchema,
        },
      ],
    });
  });
});
