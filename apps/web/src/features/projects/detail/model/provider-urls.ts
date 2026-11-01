import type { DeploymentTarget } from "@/shared/api/contracts";

/**
 * The live URL the deployed service answers on. Prefers the BE-computed value
 * (which knows what the provider actually returned at creation) and falls
 * back to each provider's deterministic naming convention. The deployed site
 * is the only provider address this app links to: never a Vercel or Render
 * dashboard, which are ALPHACI's own accounts.
 */
export function providerPublicUrl(target: DeploymentTarget): string | null {
  if (typeof target.publicUrl === "string" && target.publicUrl.trim()) {
    return target.publicUrl.trim();
  }

  if (target.provider === "render") {
    const metadataUrl = target.providerMetadata?.renderServiceUrl;
    if (typeof metadataUrl === "string" && metadataUrl.trim()) {
      return metadataUrl.trim();
    }
    return target.providerProjectName
      ? `https://${target.providerProjectName}.onrender.com`
      : null;
  }

  if (target.provider === "vercel") {
    return target.providerProjectName
      ? `https://${target.providerProjectName}.vercel.app`
      : null;
  }

  return null;
}

export function providerDisplayName(
  provider: DeploymentTarget["provider"],
): string {
  if (provider === "vercel") return "Vercel";
  if (provider === "onprem-compose") return "On-prem host";
  return "Render";
}
