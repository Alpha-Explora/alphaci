import type { DeploymentTarget } from "@/lib/api/contracts";

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

export function providerDisplayName(
  provider: DeploymentTarget["provider"],
): string {
  return provider === "vercel" ? "Vercel" : "Render";
}
