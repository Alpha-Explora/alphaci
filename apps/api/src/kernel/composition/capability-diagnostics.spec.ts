import {
  explainCapabilities,
  resolveCapabilities,
} from './capability-resolver';
import { PACK_MANIFESTS } from './manifests';
import { CAPABILITIES } from './capability-registry';
import { applyClientPolicy } from './client-policy';

function allEnabled() {
  const config: Record<string, unknown> = {
    composition: { profile: 'enterprise', edition: 'enterprise' },
  };
  for (const record of CAPABILITIES) {
    for (const flag of record.configurationFlags) {
      const [group, leaf] = flag.split('.');
      if (!group || !leaf) throw new Error('Expected two-part flag');
      const value = config[group];
      if (typeof value !== 'object' || value === null)
        config[group] = { [leaf]: true };
      else Object.assign(value, { [leaf]: true });
    }
  }
  return {
    ...config,
    composition: { profile: 'enterprise', edition: 'enterprise' },
  } satisfies { composition: { profile: string; edition: string } };
}

describe('composition explanations', () => {
  it('reports the same enabled set used by enforcement', () => {
    const config = {
      ...allEnabled(),
      composition: { profile: 'enterprise', edition: 'enterprise' },
    } as const;
    const input = { config, manifest: PACK_MANIFESTS.enterprise };
    const report = explainCapabilities(input);
    expect(report.enabled).toEqual(resolveCapabilities(input));
    expect(
      report.decisions
        .filter((row) => row.state === 'available')
        .map((row) => row.key),
    ).toEqual([...report.enabled]);
    expect(
      report.decisions.find((row) => row.key === 'identity.sso-scim'),
    ).toMatchObject({ state: 'unavailable', reason: 'not-implemented' });
    expect(
      report.decisions.find((row) => row.key === 'identity.lms-lti'),
    ).toMatchObject({ state: 'unavailable', reason: 'build-profile' });
  });

  it('separates client policy from edition and cascades dependencies', () => {
    const config = {
      ...allEnabled(),
      composition: { profile: 'enterprise', edition: 'enterprise' },
    } as const;
    const editionManifest = PACK_MANIFESTS.enterprise;
    const manifest = applyClientPolicy(editionManifest, {
      clientId: 'test',
      displayName: 'Test',
      edition: 'enterprise',
      disabledCapabilities: ['runtime.deployment-history'],
    });
    const report = explainCapabilities({ config, editionManifest, manifest });
    expect(
      report.decisions.find((row) => row.key === 'runtime.deployment-history'),
    ).toMatchObject({ reason: 'client-policy' });
    expect(
      report.decisions.find((row) => row.key === 'runtime.preview-deployments'),
    ).toMatchObject({
      reason: 'dependency',
      dependencies: ['runtime.deployment-history'],
    });
  });

  it('returns flag names rather than config values', () => {
    const config = {
      ...allEnabled(),
      deploymentHistory: { enabled: false },
      composition: { profile: 'enterprise', edition: 'enterprise' },
    } as const;
    const report = explainCapabilities({
      config,
      manifest: PACK_MANIFESTS.enterprise,
    });
    expect(
      report.decisions.find((row) => row.key === 'runtime.deployment-history'),
    ).toEqual({
      key: 'runtime.deployment-history',
      state: 'unavailable',
      reason: 'configuration',
      flags: ['deploymentHistory.enabled'],
    });
    expect(
      report.decisions.find((row) => row.key === 'runtime.preview-deployments'),
    ).toMatchObject({ reason: 'dependency' });
  });
});
