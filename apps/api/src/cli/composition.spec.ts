import { compositionReport } from './composition';
import { parseArgs } from './args';

describe('composition operator command', () => {
  it('accepts only the read-only command without flags or arguments', () => {
    expect(parseArgs(['composition'])).toEqual({ name: 'composition' });
    expect(() => parseArgs(['composition', '--tenant', 'x'])).toThrow();
    expect(() => parseArgs(['composition', 'x'])).toThrow();
  });

  it('describes real config without returning secrets or claiming action authorization', async () => {
    const secret = 'composition-test-secret-never-returned';
    const report = await compositionReport({
      SESSION_SECRET: secret,
      ALPHACI_BUILD_PROFILE: 'hosted',
      ALPHACI_EDITION: 'saas',
      NOTIFICATIONS_ENABLED: 'false',
    });
    expect(
      report.decisions.find((row) => row.key === 'platform.notifications'),
    ).toMatchObject({
      reason: 'configuration',
      flags: ['notifications.enabled'],
    });
    expect(report.notEvaluated).toContain('persona');
    expect(JSON.stringify(report)).not.toContain(secret);
    expect(report.scope).toBe('deployment-composition');
  });

  it.each(['saas', 'edu'] as const)(
    'preserves both new controls by default for %s and separates an explicit denial',
    async (edition) => {
      const env = {
        SESSION_SECRET: 'composition-test-secret-never-returned',
        ALPHACI_BUILD_PROFILE: 'hosted',
        ALPHACI_EDITION: edition,
        ENV_PROVISIONING_ENABLED: 'true',
      };
      const current = await compositionReport(env);
      expect(current.capabilityKeys).toEqual(
        expect.arrayContaining([
          'projects.release-governance',
          'runtime.managed-host-delivery',
        ]),
      );
      const denied = await compositionReport({
        ...env,
        RELEASE_GOVERNANCE_ENABLED: 'false',
        MANAGED_HOST_DELIVERY_ENABLED: 'false',
      });
      expect(denied.capabilityKeys).toEqual(
        expect.arrayContaining([
          'projects.qa-checklists',
          'runtime.env-provisioning',
        ]),
      );
      expect(denied.capabilityKeys).not.toEqual(
        expect.arrayContaining([
          'projects.release-governance',
          'runtime.managed-host-delivery',
        ]),
      );
    },
  );
});
