import type {
  DeploymentProvisioningEnvSet,
  DeploymentProvisioningRequest,
  DeploymentProvisioningTargetRequest,
  DeploymentProvisioningVariableGroup,
  EnvLane,
  EnvOwnershipMode,
  EnvProvider,
  RenderDeployMethod,
  RenderRuntime,
} from "@/shared/api/contracts";

export const lanes: EnvLane[] = ["preview", "production"];

export const renderRuntimeOptions: Array<{
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

type FallbackKind = "frontend" | "backend";

const FALLBACK_BY_KIND: Record<
  FallbackKind,
  Omit<DeploymentProvisioningTargetRequest, "ownershipMode" | "env">
> = {
  frontend: {
    slot: "frontend",
    provider: "vercel",
    branchName: "uat",
    rootDirectory: ".",
    buildCommand: "npm run build",
    renderEnvironmentName: "uat",
  },
  backend: {
    slot: "backend",
    provider: "render",
    branchName: "uat",
    rootDirectory: "backend",
    buildCommand: "npm run build",
    startCommand: "npm run start",
    renderDeployMethod: "native_git",
    renderServiceType: "web_service",
    renderRuntime: "docker",
    renderInstanceType: "free",
    renderRegion: "singapore",
    renderEnvironmentName: "uat",
    dockerContext: "backend",
    dockerfilePath: "backend/Dockerfile",
  },
};

export function laneLabel(lane: EnvLane): string {
  return lane === "production" ? "Production" : "Branch (preview)";
}

export function blankEnvSet(lane: EnvLane = "preview"): DeploymentProvisioningEnvSet {
  return { lane, vars: [] };
}

export function activeBranch(branchName: string | undefined): "uat" | "main" {
  return branchName?.trim() === "main" ? "main" : "uat";
}

export function fallbackTarget(
  selectedProjectKind?: FallbackKind,
  ownershipMode: EnvOwnershipMode = "flowci_managed",
): DeploymentProvisioningTargetRequest {
  const kind = selectedProjectKind ?? "backend";
  return {
    ...FALLBACK_BY_KIND[kind],
    ownershipMode,
    env: [blankEnvSet()],
  };
}

export function updateTargetAt(
  value: DeploymentProvisioningRequest,
  index: number,
  patch: Partial<DeploymentProvisioningTargetRequest>,
): DeploymentProvisioningRequest {
  return {
    ...value,
    targets: value.targets.map((target, currentIndex) =>
      currentIndex === index ? { ...target, ...patch } : target,
    ),
  };
}

export function updateEnvSet(
  target: DeploymentProvisioningTargetRequest,
  envSet: DeploymentProvisioningEnvSet,
): DeploymentProvisioningTargetRequest {
  return {
    ...target,
    env: [envSet],
  };
}

export function updateEnvVar(
  envSet: DeploymentProvisioningEnvSet,
  index: number,
  patch: Partial<{ key: string; value: string }>,
): DeploymentProvisioningEnvSet {
  const vars = [...envSet.vars];
  const current = vars[index] ?? { key: "", value: "" };
  vars[index] = { ...current, ...patch };
  return { ...envSet, vars };
}

export function envVarsForDisplay(
  envSet: DeploymentProvisioningEnvSet,
): Array<{ key: string; value: string }> {
  return envSet.vars.length > 0 ? envSet.vars : [{ key: "", value: "" }];
}

export function providerLabel(provider: EnvProvider): string {
  return provider === "render" ? "Render" : "Vercel";
}

export function targetKindLabel(target: DeploymentProvisioningTargetRequest): string {
  return target.provider === "vercel" ? "Vercel frontend" : "Render backend";
}

export function targetTitle(target: DeploymentProvisioningTargetRequest): string {
  if (target.slot === "standalone") {
    return "Deployment target";
  }

  return target.provider === "vercel" ? "Frontend app" : "Backend service";
}

export function targetProviderSummary(
  target: DeploymentProvisioningTargetRequest,
): string {
  const branch = activeBranch(target.branchName);
  const provider = target.provider === "vercel" ? "Vercel" : "Render";
  return `${provider} on ${branch}`;
}

export function readonlyValueLabel(value: string): string {
  return value.trim() || "Not set";
}

export function blankVariableGroup(
  provider: EnvProvider,
  index = 1,
): DeploymentProvisioningVariableGroup {
  return {
    name: `${providerLabel(provider)} variable group ${index}`,
    provider,
    appliesTo: "all",
    env: [blankEnvSet()],
  };
}

export function variableGroupsForValue(
  value: DeploymentProvisioningRequest,
  providers: EnvProvider[],
): DeploymentProvisioningVariableGroup[] {
  if (value.variableGroups?.length) {
    const fallbackProvider = providers[0] ?? "render";
    return value.variableGroups.map((group) => ({
      ...group,
      provider: group.provider ?? fallbackProvider,
    }));
  }

  if (value.sharedEnv?.length) {
    const sharedEnv = value.sharedEnv;
    return providers.map((provider) => ({
      name: `${providerLabel(provider)} shared variables`,
      provider,
      appliesTo: "all",
      env: sharedEnv,
    }));
  }

  return [];
}

export function updateVariableGroupAt(
  value: DeploymentProvisioningRequest,
  currentGroups: DeploymentProvisioningVariableGroup[],
  index: number,
  group: DeploymentProvisioningVariableGroup,
): DeploymentProvisioningRequest {
  const nextGroups = [...currentGroups];
  nextGroups[index] = {
    ...group,
    targetBranches: group.targetBranches?.map((targetKey) =>
      targetKey.endsWith(":test")
        ? `${targetKey.slice(0, -":test".length)}:uat`
        : targetKey,
    ),
  };
  return { ...value, variableGroups: nextGroups, sharedEnv: undefined };
}

export function addVariableGroup(
  value: DeploymentProvisioningRequest,
  currentGroups: DeploymentProvisioningVariableGroup[],
  provider: EnvProvider,
): DeploymentProvisioningRequest {
  const providerGroupCount = currentGroups.filter(
    (group) => group.provider === provider,
  ).length;
  return {
    ...value,
    variableGroups: [
      ...currentGroups,
      blankVariableGroup(provider, providerGroupCount + 1),
    ],
    sharedEnv: undefined,
  };
}

export function removeVariableGroup(
  value: DeploymentProvisioningRequest,
  currentGroups: DeploymentProvisioningVariableGroup[],
  index: number,
): DeploymentProvisioningRequest {
  const nextGroups = currentGroups.filter(
    (_, currentIndex) => currentIndex !== index,
  );
  return { ...value, variableGroups: nextGroups, sharedEnv: undefined };
}

export function countVars(
  envSets: DeploymentProvisioningEnvSet[] | undefined,
): number {
  return (envSets ?? []).reduce(
    (total, envSet) =>
      total +
      envSet.vars.filter((variable) => variable.key.trim() && variable.value)
        .length,
    0,
  );
}

export function targetBranchKey(target: DeploymentProvisioningTargetRequest): string {
  const branch = activeBranch(target.branchName);
  return `${target.slot}:${target.provider}:${branch}`;
}

export function targetBranchLabel(
  target: DeploymentProvisioningTargetRequest,
): string {
  const branch = activeBranch(target.branchName);
  const targetLabel = target.slot === "frontend" ? "Frontend" : "Backend";
  return `${targetLabel} - ${providerLabel(target.provider)} - ${branch}`;
}

export function targetScopeIncludes(
  group: DeploymentProvisioningVariableGroup,
  targetKey: string,
): boolean {
  return (
    group.appliesTo !== "selected" ||
    (group.targetBranches ?? []).some(
      (selectedKey) =>
        (selectedKey.endsWith(":test")
          ? `${selectedKey.slice(0, -":test".length)}:uat`
          : selectedKey) === targetKey,
    )
  );
}

export function toggleGroupTargetBranch(
  group: DeploymentProvisioningVariableGroup,
  targetKey: string,
  allTargetKeys: string[],
): DeploymentProvisioningVariableGroup {
  const selected = new Set(
    group.targetBranches?.length
      ? group.targetBranches.map((selectedKey) =>
          selectedKey.endsWith(":test")
            ? `${selectedKey.slice(0, -":test".length)}:uat`
            : selectedKey,
        )
      : allTargetKeys,
  );
  if (selected.has(targetKey)) {
    selected.delete(targetKey);
  } else {
    selected.add(targetKey);
  }

  return {
    ...group,
    appliesTo: "selected",
    targetBranches: [...selected],
  };
}

export function defaultProjectPlaceholder(
  repoShape: string,
  target: DeploymentProvisioningTargetRequest,
): string {
  if (repoShape === "multi" || repoShape === "microservices") {
    return target.slot === "frontend" ? "app-frontend-uat" : "app-backend-uat";
  }
  return "project-name-uat";
}

const OWNERSHIP_COPY: Record<
  `${EnvProvider}:${"byo" | "managed"}:${"native_git" | "other"}`,
  string
> = {
  "render:byo:native_git":
    "ALPHACI creates a Render service in your account using Render's native Git build. Render must have access to the repository.",
  "render:byo:other":
    "ALPHACI uses your Render account and deploys through the generated GitHub Actions image workflow.",
  "render:managed:native_git":
    "ALPHACI creates the Render service on the organization's Render account and deploys it as a container image built by GitHub Actions.",
  "render:managed:other":
    "ALPHACI creates the Render service on the organization's Render account and deploys it as a container image built by GitHub Actions.",
  "vercel:byo:native_git":
    "ALPHACI creates a Vercel project in your account and deploys through GitHub Actions. You do not need to install Vercel's GitHub integration.",
  "vercel:byo:other":
    "ALPHACI creates a Vercel project in your account and deploys through GitHub Actions. You do not need to install Vercel's GitHub integration.",
  "vercel:managed:native_git":
    "ALPHACI creates the Vercel project on the organization's Vercel account and deploys it through GitHub Actions from the generated workflow.",
  "vercel:managed:other":
    "ALPHACI creates the Vercel project on the organization's Vercel account and deploys it through GitHub Actions from the generated workflow.",
};

export function ownershipDescription(
  target: DeploymentProvisioningTargetRequest,
): string {
  const ownership = target.ownershipMode === "byo" ? "byo" : "managed";
  const method = target.renderDeployMethod === "native_git" ? "native_git" : "other";
  return OWNERSHIP_COPY[`${target.provider}:${ownership}:${method}`];
}

export function targetFieldAriaLabel(base: string, targetIndex: number): string {
  return targetIndex === 0 ? base : `${base} ${targetIndex + 1}`;
}

export function targetVarAriaLabel(
  base: string,
  targetIndex: number,
  variableIndex: number,
): string {
  return targetIndex === 0
    ? `${base} ${variableIndex + 1}`
    : `${base} ${targetIndex + 1}-${variableIndex + 1}`;
}

export function isPackagedRenderDeploy(
  method: RenderDeployMethod | undefined,
): boolean {
  return method !== "native_git" && method !== "existing_service";
}

export function optionalTrim(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

export function targetBranchName(value: string | undefined): string {
  return value?.trim() || "uat";
}

export function sanitizeProvisioningTarget(
  target: DeploymentProvisioningTargetRequest,
): DeploymentProvisioningTargetRequest {
  return {
    ...target,
    projectName: optionalTrim(target.projectName),
    branchName: targetBranchName(target.branchName),
    rootDirectory: optionalTrim(target.rootDirectory),
    buildCommand: optionalTrim(target.buildCommand),
    startCommand: optionalTrim(target.startCommand),
  };
}
