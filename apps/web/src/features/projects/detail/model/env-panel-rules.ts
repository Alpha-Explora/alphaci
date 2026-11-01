import type {
  DeploymentTarget,
  EnvLane,
  EnvProvider,
  EnvTargetSlot,
  EnvVarMetadata,
  EnvVarScope,
  ProvisionedProject,
  RenderRuntime,
  UsageLimitItem,
  ValidateEnvVarsResponse,
} from "@/features/projects";
import type { EnvOwnershipMode } from "@/shared/api/contracts";
import { providerDisplayName } from "./provider-urls";

export const ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]{1,127}$/;

export const USAGE_LABELS: Record<string, string> = {
  projects: "Projects",
  managed_render_services: "Archived managed Render services",
  managed_vercel_projects: "Archived managed Vercel projects",
  deployment_targets: "Deployment targets",
  env_keys: "Env keys",
  workflow_prs: "Workflow update PRs",
};

export const RENDER_RUNTIME_OPTIONS: Array<{
  value: RenderRuntime;
  label: string;
}> = [
  { value: "docker", label: "Dockerfile" },
  { value: "node", label: "Node.js / Bun" },
  { value: "python", label: "Python" },
  { value: "ruby", label: "Ruby" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "elixir", label: "Elixir" },
];

export interface EnvRow {
  key: string;
  value: string;
}

export function hostingForProject(project: ProvisionedProject): {
  provider: EnvProvider;
  slot: EnvTargetSlot;
  label: string;
} {
  const identity = [project.projectTypeId, project.serviceName, project.repoFullName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const isFrontend = /next|react|vue|angular|svelte|frontend|[-_]fe\b/.test(identity);

  return isFrontend
    ? { provider: "vercel", slot: "frontend", label: "Vercel frontend" }
    : { provider: "render", slot: "backend", label: "Render backend" };
}

export function formatRenderRuntime(
  value: RenderRuntime | string | null | undefined,
): string {
  if (!value) return "Not configured";
  if (value === "node") return "Node.js / Bun";
  if (value === "docker") return "Dockerfile";
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

export function activeBranch(branchName: string | null | undefined): string {
  return branchName === "main" ? "main" : "uat";
}

export function targetOptionLabel(target: {
  providerProjectName: string;
  provider: DeploymentTarget["provider"];
  slot: EnvTargetSlot;
  branchName: string;
  renderRuntime?: RenderRuntime | string | null;
}): string {
  const provider = providerDisplayName(target.provider);
  const branch = activeBranch(target.branchName);
  const runtime =
    target.provider === "render" && target.renderRuntime
      ? ` - ${formatRenderRuntime(target.renderRuntime)}`
      : "";
  return `${target.providerProjectName} - ${provider} ${target.slot} - ${branch}${runtime}`;
}

export function scopeLabel(scope: {
  lane: EnvLane;
  gitBranch: string | null;
}): string {
  return scope.lane === "production" ? "production" : `preview: ${scope.gitBranch}`;
}

export function scopeFilterValue(scope: {
  lane: EnvLane;
  gitBranch: string | null;
}): string {
  return scope.lane === "production" ? "production" : `preview:${scope.gitBranch}`;
}

export function isEnvKeyQuotaReached(quota: UsageLimitItem | null): boolean {
  return Boolean(quota && quota.limit > 0 && quota.current >= quota.limit);
}

export function envRowsInvalid(rows: EnvRow[]): boolean {
  const keys = new Set<string>();
  for (const row of rows) {
    if (
      !ENV_KEY_PATTERN.test(row.key) ||
      row.value === "" ||
      keys.has(row.key)
    ) {
      return true;
    }
    keys.add(row.key);
  }
  return rows.length === 0;
}

export function canSaveEnvTarget(input: {
  saving: boolean;
  branchName: string;
  targetAction: "create" | "register_existing";
  projectName: string;
  providerProjectId: string;
  providerProjectName: string;
  ownershipMode: EnvOwnershipMode;
  activeProviderConnectionId: string;
}): boolean {
  if (input.saving || !input.branchName) return false;
  if (input.targetAction === "create" && !input.projectName) return false;
  if (
    input.targetAction === "register_existing" &&
    (!input.providerProjectId || !input.providerProjectName)
  ) {
    return false;
  }
  if (input.ownershipMode === "byo" && !input.activeProviderConnectionId) {
    return false;
  }
  return true;
}

export function filterEnvMetadata(
  metadata: EnvVarMetadata[],
  filter: {
    targetId: string;
    environment: string;
    status: "all" | EnvVarMetadata["status"];
  },
): EnvVarMetadata[] {
  return metadata.filter((item) => {
    if (filter.targetId !== "all" && item.deploymentTargetId !== filter.targetId) {
      return false;
    }
    if (
      filter.environment !== "all" &&
      scopeFilterValue(item) !== filter.environment
    ) {
      return false;
    }
    if (filter.status !== "all" && item.status !== filter.status) {
      return false;
    }
    return true;
  });
}

export function presentScopeOptions(
  metadata: EnvVarMetadata[],
): Array<{ value: string; label: string }> {
  const byValue = new Map<string, { value: string; label: string }>();
  for (const item of metadata) {
    byValue.set(scopeFilterValue(item), {
      value: scopeFilterValue(item),
      label: scopeLabel(item),
    });
  }
  return [...byValue.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function bulkValidationSummary(result: ValidateEnvVarsResponse): string {
  const keys = result.keys.length ? result.keys.join(", ") : "No valid keys";
  const duplicates = result.duplicates.length
    ? ` - duplicates: ${result.duplicates.join(", ")}`
    : "";
  const invalid = result.invalidKeys.length
    ? ` - invalid: ${result.invalidKeys.join(", ")}`
    : "";
  return `${keys}${duplicates}${invalid}`;
}

export function resolveActiveTargetId(
  targetId: string,
  targets: DeploymentTarget[],
): string {
  return targetId || targets[0]?.id || "";
}

export function resolvePreviewScope(
  lane: EnvLane,
  previewBranch: string,
  trackedBranch: string | undefined,
): EnvVarScope {
  if (lane === "production") {
    return { lane: "production", gitBranch: null };
  }
  const branch = previewBranch.trim() || trackedBranch || "";
  return { lane: "preview", gitBranch: branch || null };
}

export function knownTargetBranches(targets: DeploymentTarget[]): string[] {
  return [
    ...new Set(
      targets
        .map((target) => target.branchName)
        .filter((branch): branch is string => Boolean(branch)),
    ),
  ].sort();
}
