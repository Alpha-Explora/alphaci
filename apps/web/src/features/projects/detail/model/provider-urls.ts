import type { DeploymentTarget } from "@/shared/api/contracts";

function vercelTeamSlug(target: DeploymentTarget): string {
  return typeof target.providerMetadata?.vercelTeamSlug === "string"
    ? target.providerMetadata.vercelTeamSlug.trim()
    : "";
}

export function providerDashboardUrl(target: DeploymentTarget): string | null {
  if (target.provider === "vercel") {
    const teamSlug = vercelTeamSlug(target);
    return teamSlug
      ? `https://vercel.com/${teamSlug}/${target.providerProjectName}`
      : `https://vercel.com/dashboard/project/${target.providerProjectId}`;
  }

  if (target.provider === "render") {
    return `https://dashboard.render.com/web/${target.providerProjectId}`;
  }

  return null;
}

export function providerConsoleUrl(target: DeploymentTarget): string | null {
  if (target.provider === "vercel") {
    const teamSlug = vercelTeamSlug(target);
    return teamSlug
      ? `https://vercel.com/${teamSlug}/${target.providerProjectName}/deployments`
      : `https://vercel.com/dashboard/project/${target.providerProjectId}/deployments`;
  }

  if (target.provider === "render") {
    return `https://dashboard.render.com/web/${target.providerProjectId}/logs`;
  }

  return null;
}

/**
 * The live URL the deployed service answers on. Prefers the BE-computed value
 * (which knows what the provider actually returned at creation) and falls
 * back to each provider's deterministic naming convention.
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
  return provider === "vercel" ? "Vercel" : "Render";
}
