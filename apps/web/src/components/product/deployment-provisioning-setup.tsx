"use client";

import { useEffect, useMemo } from "react";

import type {
  DeploymentProvisioningEnvSet,
  DeploymentProvisioningRequest,
  DeploymentProvisioningTargetRequest,
  DeploymentProvisioningVariableGroup,
  EnvEnvironment,
  EnvProvider,
  EnvTargetSlot,
  RenderDeployMethod,
  RenderRuntime,
  RenderServiceType,
} from "@/lib/api/contracts";
import { useProviderConnections } from "@/hooks/use-provider-connections";

interface DeploymentProvisioningSetupProps {
  enabled: boolean;
  repoShape: string;
  selectedProjectKind?: "frontend" | "backend";
  value: DeploymentProvisioningRequest;
  onChange: (value: DeploymentProvisioningRequest) => void;
  onEnabledChange?: (enabled: boolean) => void;
}

const environments: EnvEnvironment[] = ["test", "uat", "production"];
const renderRuntimeOptions: Array<{ value: RenderRuntime; label: string }> = [
  { value: "docker", label: "Dockerfile" },
  { value: "node", label: "Node.js / Bun" },
  { value: "python", label: "Python" },
  { value: "ruby", label: "Ruby" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "elixir", label: "Elixir" },
];

function blankEnvSet(environment: EnvEnvironment = "test"): DeploymentProvisioningEnvSet {
  return { environment, vars: [] };
}

function fallbackTarget(selectedProjectKind?: "frontend" | "backend"): DeploymentProvisioningTargetRequest {
  const slot: EnvTargetSlot =
    selectedProjectKind === "frontend" ? "frontend" : selectedProjectKind === "backend" ? "backend" : "standalone";
  const provider: EnvProvider = slot === "frontend" ? "vercel" : "render";
  return {
    slot,
    provider,
    ownershipMode: "flowci_managed",
    branchName: "test",
    rootDirectory: provider === "render" && slot === "backend" ? "backend" : ".",
    buildCommand: "npm run build",
    startCommand: provider === "render" ? "npm run start" : undefined,
    renderDeployMethod: provider === "render" ? "managed_image" : undefined,
    renderServiceType: provider === "render" ? "web_service" : undefined,
    renderRuntime: provider === "render" ? "docker" : undefined,
    renderInstanceType: provider === "render" ? "free" : undefined,
    renderRegion: provider === "render" ? "singapore" : undefined,
    renderEnvironmentName: "test",
    dockerContext: provider === "render" && slot === "backend" ? "backend" : provider === "render" ? "." : undefined,
    dockerfilePath: provider === "render" && slot === "backend" ? "backend/Dockerfile" : provider === "render" ? "Dockerfile" : undefined,
    env: [{ environment: "test", vars: [] }],
  };
}

function updateTargetAt(
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

function updateEnvSet(
  target: DeploymentProvisioningTargetRequest,
  envSet: DeploymentProvisioningEnvSet,
): DeploymentProvisioningTargetRequest {
  return {
    ...target,
    env: [envSet],
  };
}

function updateEnvVar(
  envSet: DeploymentProvisioningEnvSet,
  index: number,
  patch: Partial<{ key: string; value: string }>,
): DeploymentProvisioningEnvSet {
  const vars = [...envSet.vars];
  const current = vars[index] ?? { key: "", value: "" };
  vars[index] = { ...current, ...patch };
  return { ...envSet, vars };
}

function envVarsForDisplay(envSet: DeploymentProvisioningEnvSet): Array<{ key: string; value: string }> {
  return envSet.vars.length > 0 ? envSet.vars : [{ key: "", value: "" }];
}

function providerLabel(provider: EnvProvider): string {
  return provider === "render" ? "Render" : "Vercel";
}

function blankVariableGroup(provider: EnvProvider, index = 1): DeploymentProvisioningVariableGroup {
  return {
    name: `${providerLabel(provider)} variable group ${index}`,
    provider,
    appliesTo: "all",
    env: [blankEnvSet()],
  };
}

function variableGroupsForValue(
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

function updateVariableGroupAt(
  value: DeploymentProvisioningRequest,
  currentGroups: DeploymentProvisioningVariableGroup[],
  index: number,
  group: DeploymentProvisioningVariableGroup,
): DeploymentProvisioningRequest {
  const nextGroups = [...currentGroups];
  nextGroups[index] = group;
  return { ...value, variableGroups: nextGroups, sharedEnv: undefined };
}

function addVariableGroup(
  value: DeploymentProvisioningRequest,
  currentGroups: DeploymentProvisioningVariableGroup[],
  provider: EnvProvider,
): DeploymentProvisioningRequest {
  const providerGroupCount = currentGroups.filter((group) => group.provider === provider).length;
  return {
    ...value,
    variableGroups: [...currentGroups, blankVariableGroup(provider, providerGroupCount + 1)],
    sharedEnv: undefined,
  };
}

function removeVariableGroup(
  value: DeploymentProvisioningRequest,
  currentGroups: DeploymentProvisioningVariableGroup[],
  index: number,
): DeploymentProvisioningRequest {
  const nextGroups = currentGroups.filter((_, currentIndex) => currentIndex !== index);
  return { ...value, variableGroups: nextGroups, sharedEnv: undefined };
}

function countVars(envSets: DeploymentProvisioningEnvSet[] | undefined): number {
  return (envSets ?? []).reduce(
    (total, envSet) => total + envSet.vars.filter((variable) => variable.key.trim() && variable.value).length,
    0,
  );
}

function targetBranchKey(target: DeploymentProvisioningTargetRequest): string {
  const branch = target.branchName?.trim() || "test";
  return `${target.slot}:${target.provider}:${branch}`;
}

function targetBranchLabel(target: DeploymentProvisioningTargetRequest): string {
  const branch = target.branchName?.trim() || "test";
  return `${target.slot} / ${target.provider} / ${branch}`;
}

function targetScopeIncludes(group: DeploymentProvisioningVariableGroup, targetKey: string): boolean {
  return group.appliesTo !== "selected" || (group.targetBranches ?? []).includes(targetKey);
}

function toggleGroupTargetBranch(
  group: DeploymentProvisioningVariableGroup,
  targetKey: string,
  allTargetKeys: string[],
): DeploymentProvisioningVariableGroup {
  const selected = new Set(group.targetBranches?.length ? group.targetBranches : allTargetKeys);
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

function defaultProjectPlaceholder(repoShape: string, target: DeploymentProvisioningTargetRequest) {
  if (repoShape === "multi" || repoShape === "microservices") {
    return target.slot === "frontend" ? "app-frontend-test" : "app-backend-test";
  }
  return "project-name-test";
}

function ownershipDescription(target: DeploymentProvisioningTargetRequest) {
  if (target.provider === "render") {
    if (target.ownershipMode === "byo") {
      return target.renderDeployMethod === "native_git"
        ? "FlowCI creates a Render service in your account using Render's native Git build. Render must have access to the repository."
        : "FlowCI uses your Render account and deploys through the generated GitHub Actions image workflow.";
    }

    return "FlowCI packages and deploys this backend automatically.";
  }

  return target.ownershipMode === "byo"
    ? "FlowCI creates a Vercel project in your account and deploys through GitHub Actions. You do not need to install Vercel's GitHub integration."
    : "FlowCI creates the Vercel project and deploys it through GitHub Actions from the generated workflow.";
}

function withRenderDefaults(
  target: DeploymentProvisioningTargetRequest,
  patch: Partial<DeploymentProvisioningTargetRequest>,
): Partial<DeploymentProvisioningTargetRequest> {
  const nextProvider = patch.provider ?? target.provider;
  const nextSlot = patch.slot ?? target.slot;
  if (nextProvider !== "render") {
    return patch;
  }

  const isBackendSubdir = nextSlot === "backend";
  const rootDirectory = patch.rootDirectory ?? target.rootDirectory ?? (isBackendSubdir ? "backend" : ".");

  return {
    renderDeployMethod: target.renderDeployMethod ?? "managed_image",
    renderServiceType: target.renderServiceType ?? "web_service",
    renderRuntime: target.renderRuntime ?? "docker",
    renderInstanceType: target.renderInstanceType ?? "free",
    renderRegion: target.renderRegion ?? "singapore",
    renderEnvironmentName: target.renderEnvironmentName ?? "test",
    dockerContext: target.dockerContext ?? rootDirectory,
    dockerfilePath: target.dockerfilePath ?? (rootDirectory === "." ? "Dockerfile" : `${rootDirectory}/Dockerfile`),
    startCommand: target.startCommand ?? "npm run start",
    ...patch,
  };
}

export function DeploymentProvisioningSetup({
  enabled,
  repoShape,
  selectedProjectKind,
  value,
  onChange,
  onEnabledChange,
}: Readonly<DeploymentProvisioningSetupProps>) {
  const targets = useMemo(
    () => (value.targets.length > 0 ? value.targets : [fallbackTarget(selectedProjectKind)]),
    [selectedProjectKind, value.targets],
  );
  const needsProviderConnections = enabled && targets.some((target) => target.ownershipMode === "byo");
  const { connections: providerConnections, loading: providerConnectionsLoading } =
    useProviderConnections(needsProviderConnections);
  const activeProviderConnections = useMemo(
    () => providerConnections.filter((connection) => connection.status === "active"),
    [providerConnections],
  );
  const targetProviders = useMemo(
    () => [...new Set(targets.map((target) => target.provider))],
    [targets],
  );
  const variableGroups = useMemo(
    () => variableGroupsForValue(value, targetProviders),
    [targetProviders, value],
  );
  const targetBranchOptions = useMemo(
    () =>
      targets.map((target) => ({
        key: targetBranchKey(target),
        label: targetBranchLabel(target),
        provider: target.provider,
      })),
    [targets],
  );
  const groupVarCount = variableGroups.reduce((total, group) => total + countVars(group.env), 0);
  const branchVarCount = targets.reduce((total, target) => total + countVars(target.env), 0);

  useEffect(() => {
    if (!enabled || providerConnectionsLoading) {
      return;
    }

    let changed = false;
    const nextTargets = targets.map((target) => {
      if (target.ownershipMode !== "byo") {
        return target;
      }

      const matchingConnections = activeProviderConnections.filter(
        (connection) => connection.provider === target.provider,
      );
      const selectedConnection = matchingConnections.find(
        (connection) => connection.id === target.providerConnectionId,
      );

      if (selectedConnection) {
        return target;
      }

      changed = true;
      return {
        ...target,
        providerConnectionId: matchingConnections[0]?.id,
      };
    });

    if (changed) {
      onChange({ ...value, targets: nextTargets });
    }
  }, [activeProviderConnections, enabled, onChange, providerConnectionsLoading, targets, value]);

  return (
    <div className="deployment-provisioning-setup">
      <div className="deployment-provisioning-setup__header">
        <div>
          <span className="controls-panel-label">Deployment provisioning</span>
          <p className="helper-text" style={{ margin: "0.35rem 0 0" }}>
            Create provider targets during setup, then send initial env vars directly to the provider.
          </p>
        </div>
        <label className="toggle-row">
          <input
            type="checkbox"
            aria-label="Provision deployment target"
            checked={enabled}
            onChange={(event) => {
              const nextEnabled = event.target.checked;
              if (onEnabledChange) {
                onEnabledChange(nextEnabled);
                return;
              }
              onChange({ ...value, enabled: nextEnabled });
            }}
          />
          <span>Provision deployment target</span>
        </label>
      </div>

      {enabled ? (
        <div className="deployment-provisioning-setup__body">
          <section className="deployment-provisioning-flow" aria-label="Deployment provisioning flow">
            <div className="deployment-flow-step">
              <span className="deployment-flow-step__index">1</span>
              <div>
                <strong>Target map</strong>
                <div className="deployment-flow-branches">
                  {targets.map((target, targetIndex) => (
                    <span className="deployment-flow-branch" key={`${target.slot}-${targetIndex}`}>
                      {target.slot} / {target.provider} / {target.branchName?.trim() || "test"}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="deployment-flow-step">
              <span className="deployment-flow-step__index">2</span>
              <div>
                <strong>Variable groups</strong>
                <span>
                  {variableGroups.length} group{variableGroups.length === 1 ? "" : "s"} / {groupVarCount} variable{groupVarCount === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <div className="deployment-flow-step">
              <span className="deployment-flow-step__index">3</span>
              <div>
                <strong>Branch variables</strong>
                <span>{branchVarCount} branch-specific variable{branchVarCount === 1 ? "" : "s"}</span>
              </div>
            </div>
          </section>

          <section className="env-provisioning-section deployment-variable-groups">
            <div className="env-section-header">
              <div>
                <h4>Variable groups</h4>
                <p className="helper-text" style={{ margin: "0.25rem 0 0" }}>
                  Create provider-specific groups. Render groups only apply to Render targets, and Vercel groups only apply to Vercel targets.
                </p>
              </div>
            </div>

            {targetProviders.map((provider) => {
              const providerTargets = targetBranchOptions.filter((option) => option.provider === provider);
              const providerGroups = variableGroups
                .map((group, groupIndex) => ({ group, groupIndex }))
                .filter(({ group }) => group.provider === provider);
              return (
                <div className="deployment-provider-groups" key={provider}>
                  <div className="deployment-provider-groups__header">
                    <div>
                      <strong>{providerLabel(provider)} variable groups</strong>
                      <p className="helper-text" style={{ margin: "0.25rem 0 0" }}>
                        {providerTargets.length} {providerLabel(provider)} target branch{providerTargets.length === 1 ? "" : "es"} available.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ghost-button deployment-variable-panel__button"
                      onClick={() => onChange(addVariableGroup(value, variableGroups, provider))}
                    >
                      Create {providerLabel(provider)} group
                    </button>
                  </div>

                  {providerGroups.length === 0 ? (
                    <p className="env-empty-state">No {providerLabel(provider)} variable groups yet.</p>
                  ) : null}

                  {providerGroups.map(({ group, groupIndex }) => {
                    const envSet = group.env[0] ?? blankEnvSet();
                    const sharedVars = envVarsForDisplay(envSet);
                    const providerTargetKeys = providerTargets.map((target) => target.key);

                    return (
                      <div className="deployment-variable-panel" key={`group-${groupIndex}`}>
                        <div className="deployment-variable-panel__header">
                          <div className="deployment-variable-panel__scope">
                            <label>
                              <span>Group name</span>
                              <input
                                aria-label={`Variable group name ${groupIndex + 1}`}
                                value={group.name ?? `${providerLabel(provider)} variable group ${groupIndex + 1}`}
                                onChange={(event) =>
                                  onChange(
                                    updateVariableGroupAt(value, variableGroups, groupIndex, {
                                      ...group,
                                      name: event.target.value,
                                    }),
                                  )
                                }
                              />
                            </label>
                          </div>
                          <label className="deployment-variable-panel__environment">
                            <span>Apply to</span>
                            <select
                              aria-label={`Variable group scope ${groupIndex + 1}`}
                              value={group.appliesTo ?? "all"}
                              onChange={(event) =>
                                onChange(
                                  updateVariableGroupAt(value, variableGroups, groupIndex, {
                                    ...group,
                                    appliesTo: event.target.value as "all" | "selected",
                                    targetBranches:
                                      event.target.value === "selected"
                                        ? group.targetBranches?.length
                                          ? group.targetBranches.filter((targetKey) => providerTargetKeys.includes(targetKey))
                                          : providerTargetKeys
                                        : undefined,
                                  }),
                                )
                              }
                            >
                              <option value="all">All {providerLabel(provider)} branches</option>
                              <option value="selected">Selected {providerLabel(provider)} branches</option>
                            </select>
                          </label>
                          <label className="deployment-variable-panel__environment">
                            <span>Provider environment</span>
                            <select
                              aria-label={`Variable group environment ${groupIndex + 1}`}
                              value={envSet.environment}
                              onChange={(event) =>
                                onChange(
                                  updateVariableGroupAt(value, variableGroups, groupIndex, {
                                    ...group,
                                    env: [{ ...envSet, environment: event.target.value as EnvEnvironment }],
                                  }),
                                )
                              }
                            >
                              {environments.map((environment) => (
                                <option key={environment} value={environment}>
                                  {environment}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className="ghost-button deployment-variable-panel__button"
                            onClick={() =>
                              onChange(
                                updateVariableGroupAt(value, variableGroups, groupIndex, {
                                  ...group,
                                  env: [{ ...envSet, vars: [...sharedVars, { key: "", value: "" }] }],
                                }),
                              )
                            }
                          >
                            Add variable
                          </button>
                          <button
                            type="button"
                            className="env-var-row__remove env-var-remove"
                            aria-label={`Remove variable group ${groupIndex + 1}`}
                            disabled={providerGroups.length === 1 && sharedVars.length === 1 && !sharedVars[0]?.key && !sharedVars[0]?.value}
                            onClick={() => onChange(removeVariableGroup(value, variableGroups, groupIndex))}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>

                        <div className="deployment-variable-panel__targets" aria-label={`Variable group targets ${groupIndex + 1}`}>
                          <span>{group.appliesTo === "selected" ? `Selected ${providerLabel(provider)} branches` : `Applies to all ${providerLabel(provider)} branches`}</span>
                          <div className="deployment-flow-branches">
                            {providerTargets.map((option) => (
                              <button
                                type="button"
                                className={[
                                  "deployment-flow-branch",
                                  "deployment-flow-branch--button",
                                  targetScopeIncludes(group, option.key) ? "active" : "",
                                ].filter(Boolean).join(" ")}
                                key={option.key}
                                disabled={group.appliesTo !== "selected"}
                                onClick={() =>
                                  onChange(
                                    updateVariableGroupAt(
                                      value,
                                      variableGroups,
                                      groupIndex,
                                      toggleGroupTargetBranch(group, option.key, providerTargetKeys),
                                    ),
                                  )
                                }
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {sharedVars.map((variable, variableIndex) => (
                          <div className="env-var-row" key={`group-${groupIndex}-${variableIndex}`}>
                            <label>
                              <span>Key</span>
                              <input
                                aria-label={`Group variable key ${groupIndex + 1}-${variableIndex + 1}`}
                                value={variable.key}
                                onChange={(event) => {
                                  const nextEnvSet = updateEnvVar(envSet, variableIndex, { key: event.target.value.toUpperCase() });
                                  onChange(updateVariableGroupAt(value, variableGroups, groupIndex, { ...group, env: [nextEnvSet] }));
                                }}
                                placeholder="DATABASE_URL"
                              />
                            </label>
                            <label>
                              <span>Value</span>
                              <input
                                aria-label={`Group variable value ${groupIndex + 1}-${variableIndex + 1}`}
                                type="password"
                                value={variable.value}
                                onChange={(event) => {
                                  const nextEnvSet = updateEnvVar(envSet, variableIndex, { value: event.target.value });
                                  onChange(updateVariableGroupAt(value, variableGroups, groupIndex, { ...group, env: [nextEnvSet] }));
                                }}
                                placeholder="value"
                              />
                            </label>
                            <button
                              type="button"
                              className="env-var-row__remove env-var-remove"
                              aria-label={`Remove group variable ${groupIndex + 1}-${variableIndex + 1}`}
                              disabled={sharedVars.length === 1 && !variable.key && !variable.value}
                              onClick={() => {
                                const nextVars = sharedVars.filter((_, currentIndex) => currentIndex !== variableIndex);
                                onChange(
                                  updateVariableGroupAt(value, variableGroups, groupIndex, {
                                    ...group,
                                    env: [{ ...envSet, vars: nextVars.length ? nextVars : [{ key: "", value: "" }] }],
                                  }),
                                );
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </section>

          {targets.map((target, targetIndex) => {
            const envSet = target.env?.[0] ?? { environment: "test" as EnvEnvironment, vars: [] };
            const vars = envVarsForDisplay(envSet);
            const matchingConnections = activeProviderConnections.filter(
              (connection) => connection.provider === target.provider,
            );
            const selectedProviderConnectionId = target.providerConnectionId ?? matchingConnections[0]?.id ?? "";

            return (
              <section className="env-provisioning-section" key={`${target.slot}-${targetIndex}`}>
                <div className="env-section-header">
                  <div>
                    <h4>{target.slot === "standalone" ? "Deployment target" : `${target.slot} target`}</h4>
                    <p className="helper-text" style={{ margin: "0.25rem 0 0" }}>
                      {target.provider === "vercel" ? "Vercel project" : "Render service"} on the test branch.
                    </p>
                  </div>
                </div>

                <div className="env-target-grid">
                  <label className="env-target-grid__field env-target-grid__field--compact">
                    <span>Slot</span>
                    <select
                      aria-label={targetIndex === 0 ? "Target slot" : `Target slot ${targetIndex + 1}`}
                      value={target.slot}
                      onChange={(event) =>
                        onChange(
                          updateTargetAt(value, targetIndex, {
                            slot: event.target.value as EnvTargetSlot,
                            provider: event.target.value === "frontend" ? "vercel" : target.provider,
                            ...(event.target.value === "backend" && target.provider === "render"
                              ? {
                                  rootDirectory: "backend",
                                  dockerContext: "backend",
                                  dockerfilePath: "backend/Dockerfile",
                                }
                              : {}),
                          }),
                        )
                      }
                    >
                      <option value="standalone">Standalone</option>
                      <option value="backend">Backend</option>
                      <option value="frontend">Frontend</option>
                    </select>
                  </label>
                  <label className="env-target-grid__field env-target-grid__field--compact">
                    <span>Provider</span>
                    <select
                      aria-label={targetIndex === 0 ? "Provider" : `Provider ${targetIndex + 1}`}
                      value={target.provider}
                      onChange={(event) => {
                        const provider = event.target.value as EnvProvider;
                        const providerConnectionId =
                          target.ownershipMode === "byo"
                            ? activeProviderConnections.find((connection) => connection.provider === provider)?.id
                            : undefined;
                        onChange(
                          updateTargetAt(
                            value,
                            targetIndex,
                            withRenderDefaults(target, {
                              provider,
                              providerConnectionId,
                              ...(provider === "vercel"
                                ? {
                                    renderDeployMethod: undefined,
                                    renderServiceType: undefined,
                                    renderRuntime: undefined,
                                    renderInstanceType: undefined,
                                    renderRegion: undefined,
                                    renderEnvironmentName: undefined,
                                    dockerContext: undefined,
                                    dockerfilePath: undefined,
                                  }
                                : {}),
                            }),
                          ),
                        );
                      }}
                    >
                      <option value="render">Render</option>
                      <option value="vercel">Vercel</option>
                    </select>
                  </label>
                  <label className="env-target-grid__field env-target-grid__field--wide">
                    <span>Ownership</span>
                    <select
                      aria-label={targetIndex === 0 ? "Provider ownership" : `Provider ownership ${targetIndex + 1}`}
                      value={target.ownershipMode}
                      onChange={(event) => {
                        const ownershipMode = event.target.value as DeploymentProvisioningTargetRequest["ownershipMode"];
                        const providerConnectionId =
                          ownershipMode === "byo"
                            ? matchingConnections[0]?.id ?? target.providerConnectionId
                            : undefined;
                        onChange(
                          updateTargetAt(value, targetIndex, {
                            ownershipMode,
                            providerConnectionId,
                          }),
                        );
                      }}
                    >
                      <option value="flowci_managed">Managed by FlowCI</option>
                      <option value="byo">Use my {target.provider === "render" ? "Render" : "Vercel"} account</option>
                    </select>
                    <span className="helper-text env-target-grid__note">
                      {ownershipDescription(target)}
                    </span>
                  </label>
                  {target.ownershipMode === "byo" ? (
                    <label className="env-target-grid__field env-target-grid__field--wide">
                      <span>Provider connection</span>
                      <select
                        aria-label={targetIndex === 0 ? "Provider connection" : `Provider connection ${targetIndex + 1}`}
                        value={selectedProviderConnectionId}
                        disabled={providerConnectionsLoading || matchingConnections.length === 0}
                        onChange={(event) =>
                          onChange(updateTargetAt(value, targetIndex, { providerConnectionId: event.target.value }))
                        }
                      >
                        {matchingConnections.length ? (
                          matchingConnections.map((connection) => (
                            <option key={connection.id} value={connection.id}>
                              {connection.label} - {connection.tokenLastFour}
                            </option>
                          ))
                        ) : (
                          <option value="">No saved {target.provider} connection</option>
                        )}
                      </select>
                    </label>
                  ) : null}
                  <label className="env-target-grid__field env-target-grid__field--wide">
                    <span>Project name</span>
                    <input
                      aria-label={targetIndex === 0 ? "Provider project name" : `Provider project name ${targetIndex + 1}`}
                      value={target.projectName ?? ""}
                      onChange={(event) => onChange(updateTargetAt(value, targetIndex, { projectName: event.target.value }))}
                      placeholder={defaultProjectPlaceholder(repoShape, target)}
                    />
                  </label>
                  <label className="env-target-grid__field env-target-grid__field--compact">
                    <span>Branch</span>
                    <input
                      aria-label={targetIndex === 0 ? "Provider branch" : `Provider branch ${targetIndex + 1}`}
                      value={target.branchName ?? "test"}
                      onChange={(event) => onChange(updateTargetAt(value, targetIndex, { branchName: event.target.value }))}
                    />
                  </label>
                  <label className="env-target-grid__field env-target-grid__field--compact">
                    <span>Root directory</span>
                    <input
                      aria-label={targetIndex === 0 ? "Provider root directory" : `Provider root directory ${targetIndex + 1}`}
                      value={target.rootDirectory ?? "."}
                      onChange={(event) => onChange(updateTargetAt(value, targetIndex, { rootDirectory: event.target.value }))}
                    />
                  </label>
                  <label className="env-target-grid__field env-target-grid__field--wide">
                    <span>Build command</span>
                    <input
                      aria-label={targetIndex === 0 ? "Provider build command" : `Provider build command ${targetIndex + 1}`}
                      value={target.buildCommand ?? ""}
                      onChange={(event) => onChange(updateTargetAt(value, targetIndex, { buildCommand: event.target.value }))}
                    />
                  </label>
                  {target.provider === "render" ? (
                    <>
                      <label className="env-target-grid__field env-target-grid__field--wide">
                        <span>Deployment method</span>
                        <select
                          aria-label={targetIndex === 0 ? "Render deployment method" : `Render deployment method ${targetIndex + 1}`}
                          value={target.renderDeployMethod ?? (target.ownershipMode === "byo" ? "native_git" : "managed_image")}
                          onChange={(event) =>
                            onChange(
                              updateTargetAt(value, targetIndex, {
                                renderDeployMethod: event.target.value as RenderDeployMethod,
                                action:
                                  event.target.value === "existing_service"
                                    ? "register_existing"
                                    : "create",
                              }),
                            )
                          }
                        >
                          {target.ownershipMode === "flowci_managed" ? (
                            <option value="managed_image">Automatic package deploy</option>
                          ) : null}
                          {target.ownershipMode === "byo" ? (
                            <>
                              <option value="native_git">Native Render build</option>
                              <option value="byo_image">GitHub Actions image deploy</option>
                              <option value="existing_service">Existing Render service</option>
                            </>
                          ) : null}
                        </select>
                        <span className="helper-text env-target-grid__note">
                          {target.renderDeployMethod === "native_git"
                            ? "Uses Render build/start commands and requires Render repository access."
                            : "FlowCI packages and deploys this backend automatically."}
                        </span>
                      </label>
                      <label className="env-target-grid__field env-target-grid__field--compact">
                        <span>Service type</span>
                        <select
                          aria-label={targetIndex === 0 ? "Render service type" : `Render service type ${targetIndex + 1}`}
                          value={target.renderServiceType ?? "web_service"}
                          onChange={(event) =>
                            onChange(
                              updateTargetAt(value, targetIndex, {
                                renderServiceType: event.target.value as RenderServiceType,
                              }),
                            )
                          }
                        >
                          <option value="web_service">Web service</option>
                          <option value="private_service">Private service</option>
                          <option value="background_worker">Worker</option>
                          <option value="cron_job">Cron job</option>
                        </select>
                      </label>
                      <label className="env-target-grid__field env-target-grid__field--compact">
                        <span>Runtime</span>
                        <select
                          aria-label={targetIndex === 0 ? "Render runtime" : `Render runtime ${targetIndex + 1}`}
                          value={target.renderRuntime ?? "docker"}
                          onChange={(event) =>
                            onChange(
                              updateTargetAt(value, targetIndex, {
                                renderRuntime: event.target.value as RenderRuntime,
                              }),
                            )
                          }
                        >
                          {renderRuntimeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <span className="helper-text env-target-grid__note">
                          {target.renderDeployMethod === "native_git"
                            ? "Render uses this runtime for its native Git build."
                            : "Image-backed deploys run as a Docker image; this records the service runtime intent."}
                        </span>
                      </label>
                      <label className="env-target-grid__field env-target-grid__field--compact">
                        <span>Instance</span>
                        <input
                          aria-label={targetIndex === 0 ? "Render instance type" : `Render instance type ${targetIndex + 1}`}
                          value={target.renderInstanceType ?? "free"}
                          onChange={(event) => onChange(updateTargetAt(value, targetIndex, { renderInstanceType: event.target.value }))}
                        />
                      </label>
                      <label className="env-target-grid__field env-target-grid__field--compact">
                        <span>Region</span>
                        <input
                          aria-label={targetIndex === 0 ? "Render region" : `Render region ${targetIndex + 1}`}
                          value={target.renderRegion ?? "singapore"}
                          onChange={(event) => onChange(updateTargetAt(value, targetIndex, { renderRegion: event.target.value }))}
                        />
                      </label>
                      {target.renderDeployMethod === "native_git" ? (
                        <label className="env-target-grid__field env-target-grid__field--wide">
                          <span>Start command</span>
                          <input
                            aria-label={targetIndex === 0 ? "Provider start command" : `Provider start command ${targetIndex + 1}`}
                            value={target.startCommand ?? ""}
                            onChange={(event) => onChange(updateTargetAt(value, targetIndex, { startCommand: event.target.value }))}
                          />
                        </label>
                      ) : null}
                      {target.renderDeployMethod === "existing_service" ? (
                        <>
                          <label className="env-target-grid__field env-target-grid__field--wide">
                            <span>Service ID</span>
                            <input
                              aria-label={targetIndex === 0 ? "Render service ID" : `Render service ID ${targetIndex + 1}`}
                              value={target.providerProjectId ?? ""}
                              onChange={(event) => onChange(updateTargetAt(value, targetIndex, { providerProjectId: event.target.value }))}
                              placeholder="srv-..."
                            />
                          </label>
                          <label className="env-target-grid__field env-target-grid__field--wide">
                            <span>Service name</span>
                            <input
                              aria-label={targetIndex === 0 ? "Render service name" : `Render service name ${targetIndex + 1}`}
                              value={target.providerProjectName ?? ""}
                              onChange={(event) => onChange(updateTargetAt(value, targetIndex, { providerProjectName: event.target.value }))}
                              placeholder="api-test"
                            />
                          </label>
                        </>
                      ) : null}
                      {target.ownershipMode === "flowci_managed" && (target.renderInstanceType ?? "free") !== "free" ? (
                        <p className="helper-text env-target-grid__field env-target-grid__field--wide" style={{ margin: 0 }}>
                          Paid managed Render services require FlowCI approval. Use free or connect your own Render account.
                        </p>
                      ) : null}
                      {target.renderDeployMethod !== "native_git" && target.renderDeployMethod !== "existing_service" ? (
                        <details className="env-target-grid__field env-target-grid__field--wide">
                          <summary>Packaging details</summary>
                          <p className="helper-text">Uses a generated Dockerfile and GitHub Actions image deployment.</p>
                          <label>
                            <span>Docker context</span>
                            <input
                              aria-label={targetIndex === 0 ? "Docker context" : `Docker context ${targetIndex + 1}`}
                              value={target.dockerContext ?? target.rootDirectory ?? "."}
                              onChange={(event) => onChange(updateTargetAt(value, targetIndex, { dockerContext: event.target.value }))}
                            />
                          </label>
                          <label>
                            <span>Dockerfile path</span>
                            <input
                              aria-label={targetIndex === 0 ? "Dockerfile path" : `Dockerfile path ${targetIndex + 1}`}
                              value={target.dockerfilePath ?? "Dockerfile"}
                              onChange={(event) => onChange(updateTargetAt(value, targetIndex, { dockerfilePath: event.target.value }))}
                            />
                          </label>
                        </details>
                      ) : null}
                    </>
                  ) : null}
                  <label className="env-target-grid__field env-target-grid__field--compact">
                    <span>Environment</span>
                    <select
                      aria-label={targetIndex === 0 ? "Provisioning environment" : `Provisioning environment ${targetIndex + 1}`}
                      value={envSet.environment}
                      onChange={(event) =>
                        onChange(
                          updateTargetAt(value, targetIndex, {
                            env: [{ ...envSet, environment: event.target.value as EnvEnvironment }],
                          }),
                        )
                      }
                    >
                      {environments.map((environment) => (
                        <option key={environment} value={environment}>
                          {environment}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="env-section-header deployment-provisioning-setup__vars-header">
                  <div>
                    <strong>Branch-specific variables</strong>
                    <p className="helper-text" style={{ margin: "0.25rem 0 0" }}>
                      {targetBranchLabel(target)} can override shared keys or add its own values. Values are sent to the provider during setup and are not stored by FlowCI.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      onChange(
                        updateTargetAt(value, targetIndex, {
                          env: [{ ...envSet, vars: [...vars, { key: "", value: "" }] }],
                        }),
                      )
                    }
                  >
                    Add variable
                  </button>
                </div>

                {target.provider === "vercel" ? (
                  <p className="helper-text" style={{ margin: "0 0 0.6rem" }}>
                    FlowCI will install per-slot GitHub Actions secrets for Vercel deployment after the Vercel project is created.
                  </p>
                ) : null}

                {vars.map((variable, variableIndex) => (
                  <div className="env-var-row" key={`${target.slot}-${targetIndex}-${variableIndex}`}>
                    <label>
                      <span>Key</span>
                      <input
                        aria-label={
                          targetIndex === 0
                            ? `Variable key ${variableIndex + 1}`
                            : `Variable key ${targetIndex + 1}-${variableIndex + 1}`
                        }
                        value={variable.key}
                        onChange={(event) => {
                          const nextEnvSet = updateEnvVar(envSet, variableIndex, { key: event.target.value.toUpperCase() });
                          onChange(updateTargetAt(value, targetIndex, updateEnvSet(target, nextEnvSet)));
                        }}
                        placeholder="DATABASE_URL"
                      />
                    </label>
                    <label>
                      <span>Value</span>
                      <input
                        aria-label={
                          targetIndex === 0
                            ? `Variable value ${variableIndex + 1}`
                            : `Variable value ${targetIndex + 1}-${variableIndex + 1}`
                        }
                        type="password"
                        value={variable.value}
                        onChange={(event) => {
                          const nextEnvSet = updateEnvVar(envSet, variableIndex, { value: event.target.value });
                          onChange(updateTargetAt(value, targetIndex, updateEnvSet(target, nextEnvSet)));
                        }}
                        placeholder="value"
                      />
                    </label>
                    <button
                      type="button"
                      className="env-var-row__remove env-var-remove"
                      aria-label={
                        targetIndex === 0
                          ? `Remove variable ${variableIndex + 1}`
                          : `Remove variable ${targetIndex + 1}-${variableIndex + 1}`
                      }
                      disabled={vars.length === 1 && !variable.key && !variable.value}
                      onClick={() => {
                        const nextVars = vars.filter((_, currentIndex) => currentIndex !== variableIndex);
                        onChange(
                          updateTargetAt(value, targetIndex, {
                            env: [{ ...envSet, vars: nextVars.length ? nextVars : [{ key: "", value: "" }] }],
                          }),
                        );
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
