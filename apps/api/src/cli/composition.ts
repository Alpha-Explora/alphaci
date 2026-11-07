import { buildAppConfig } from '../kernel/config/app.config';
import { applyClientPolicy } from '../kernel/composition/client-policy';
import { loadClientPolicyPack } from '../kernel/composition/client-policy-pack-loader';
import { explainCapabilities } from '../kernel/composition/capability-resolver';
import { PACK_MANIFESTS } from '../kernel/composition/manifests';

/** Reads local composition only; never opens a database or calls a provider. */
export async function compositionReport(env: NodeJS.ProcessEnv) {
  const config = buildAppConfig(env);
  const editionManifest = PACK_MANIFESTS[config.composition.edition];
  const pack = await loadClientPolicyPack(config.composition.profile);
  const policy = pack?.createSource(config.composition).deployment() ?? null;
  const { enabled, decisions } = explainCapabilities({
    config,
    editionManifest,
    manifest: applyClientPolicy(editionManifest, policy),
  });
  return {
    scope: 'deployment-composition',
    edition: config.composition.edition,
    buildProfile: config.composition.profile,
    clientPolicyActive: policy !== null,
    capabilityKeys: [...enabled],
    decisions,
    notEvaluated: [
      'provider-readiness',
      'subscription',
      'persona',
      'resource-access',
      'workflow-preconditions',
    ],
  };
}
