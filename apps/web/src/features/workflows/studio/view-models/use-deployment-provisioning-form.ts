"use client";

import { useMemo, useState } from "react";

import type {
  DeploymentProvisioningEnvSet,
  DeploymentProvisioningRequest,
  DeploymentProvisioningTargetRequest,
  DeploymentProvisioningVariableGroup,
  EnvProvider,
  EnvTargetSlot,
} from "@/shared/api/contracts";

function defaultProviderForSlot(slot: EnvTargetSlot): EnvProvider {
  return slot === "frontend" ? "vercel" : "render";
}

function defaultTarget(
  slot: EnvTargetSlot,
  projectName: string,
): DeploymentProvisioningTargetRequest {
  const normalizedSlot: EnvTargetSlot =
    slot === "frontend" ? "frontend" : "backend";
  const provider = defaultProviderForSlot(normalizedSlot);
  return {
    slot: normalizedSlot,
    provider,
    // BYO hosting is archived: every target deploys on the platform's
    // centralized Render/Vercel accounts.
    ownershipMode: "flowci_managed",
    projectName,
    branchName: "uat",
    rootDirectory: normalizedSlot === "backend" ? "backend" : ".",
    buildCommand:
      provider === "render" ? "npm ci && npm run build" : "npm run build",
    startCommand: provider === "render" ? "npm run start:prod" : undefined,
    renderDeployMethod: provider === "render" ? "native_git" : undefined,
    renderServiceType: provider === "render" ? "web_service" : undefined,
    renderRuntime: provider === "render" ? "docker" : undefined,
    renderInstanceType: provider === "render" ? "free" : undefined,
    // Preview with no branch named: the wizard means "the branch this target
    // tracks", which the backend resolves from the target itself.
    env: [{ lane: "preview" as const, vars: [] }],
  };
}

function sanitizedEnvSets(
  envSets: DeploymentProvisioningEnvSet[] | undefined,
): DeploymentProvisioningEnvSet[] {
  return (envSets ?? [])
    .map((envSet) => ({
      ...envSet,
      vars: envSet.vars.filter(
        (variable) => variable.key.trim() && variable.value,
      ),
    }))
    .filter((envSet) => envSet.vars.length > 0);
}

function sanitizedVariableGroups(
  groups: DeploymentProvisioningVariableGroup[] | undefined,
  activeProviders: Set<EnvProvider>,
): DeploymentProvisioningVariableGroup[] {
  return (groups ?? [])
    .map((group, index) => {
      const provider = group.provider ?? [...activeProviders][0] ?? "render";
      const appliesTo = group.appliesTo ?? "all";
      const env = sanitizedEnvSets(group.env);
      const targetBranches = [...new Set(group.targetBranches ?? [])].filter(
        Boolean,
      );

      return {
        name: group.name?.trim() || `Variable group ${index + 1}`,
        provider,
        appliesTo,
        ...(appliesTo === "selected" ? { targetBranches } : {}),
        env,
      };
    })
    .filter(
      (group) =>
        activeProviders.has(group.provider) &&
        group.env.length > 0 &&
        (group.appliesTo !== "selected" ||
          (group.targetBranches?.length ?? 0) > 0),
    );
}

function targetBranchKey(target: DeploymentProvisioningTargetRequest): string {
  const branch = target.branchName?.trim() || "uat";
  return `${target.slot}:${target.provider}:${branch}`;
}

function countEnvVars(envSets: DeploymentProvisioningEnvSet[] | undefined) {
  return (envSets ?? []).reduce(
    (total, envSet) => total + envSet.vars.length,
    0,
  );
}

function countRenderVariables(
  targets: DeploymentProvisioningTargetRequest[],
  variableGroups: DeploymentProvisioningVariableGroup[],
): number {
  const renderTargetKeys = new Set(
    targets
      .filter((target) => target.provider === "render")
      .map((target) => targetBranchKey(target)),
  );

  if (renderTargetKeys.size === 0) {
    return 0;
  }

  const branchVarCount = targets
    .filter((target) => target.provider === "render")
    .reduce((total, target) => total + countEnvVars(target.env), 0);

  const groupVarCount = variableGroups
    .filter((group) => {
      if (group.provider !== "render") {
        return false;
      }

      if (group.appliesTo !== "selected") {
        return true;
      }

      return (group.targetBranches ?? []).some((targetKey) =>
        renderTargetKeys.has(targetKey),
      );
    })
    .reduce((total, group) => total + countEnvVars(group.env), 0);

  return branchVarCount + groupVarCount;
}

export function useDeploymentProvisioningForm() {
  const [enabled, setEnabled] = useState(false);
  const [request, setRequest] = useState<DeploymentProvisioningRequest>({
    enabled: false,
    targets: [defaultTarget("backend", "")],
  });

  function setDefaultTarget(slot: EnvTargetSlot, projectName: string) {
    setRequest({
      enabled: true,
      targets: [defaultTarget(slot, projectName)],
    });
    setEnabled(true);
  }

  function setDefaultTargets(
    targets: Array<{ slot: EnvTargetSlot; projectName: string }>,
  ) {
    setRequest({
      enabled: true,
      targets: targets.map((target) =>
        defaultTarget(target.slot, target.projectName),
      ),
    });
    setEnabled(true);
  }

  const payload = useMemo<DeploymentProvisioningRequest | undefined>(() => {
    if (!enabled) {
      return undefined;
    }

    const sharedEnv = sanitizedEnvSets(request.sharedEnv);
    const activeProviders = new Set(
      request.targets.map((target) => target.provider),
    );
    const variableGroups = sanitizedVariableGroups(
      request.variableGroups,
      activeProviders,
    );

    const targets = request.targets.map((target) => ({
      ...target,
      projectName: target.projectName?.trim() || undefined,
      branchName: target.branchName?.trim() || "uat",
      rootDirectory: target.rootDirectory?.trim() || undefined,
      buildCommand: target.buildCommand?.trim() || undefined,
      startCommand: target.startCommand?.trim() || undefined,
      env: sanitizedEnvSets(target.env),
    }));

    return {
      ...request,
      enabled: true,
      ...(variableGroups.length
        ? { variableGroups }
        : { variableGroups: undefined }),
      ...(sharedEnv.length ? { sharedEnv } : { sharedEnv: undefined }),
      targets,
    };
  }, [enabled, request]);

  const renderVariableCount = useMemo(() => {
    if (!payload) {
      return 0;
    }

    return countRenderVariables(
      payload.targets,
      payload.variableGroups ?? [],
    );
  }, [payload]);
  const renderVariablesRequired = Boolean(
    payload?.targets.some((target) => target.provider === "render"),
  );
  const renderVariablesMissing =
    renderVariablesRequired && renderVariableCount === 0;

  return {
    enabled,
    payload,
    renderVariableCount,
    renderVariablesMissing,
    renderVariablesRequired,
    request,
    setDefaultTarget,
    setDefaultTargets,
    setEnabled,
    setRequest,
  };
}

export type DeploymentProvisioningFormState = ReturnType<
  typeof useDeploymentProvisioningForm
>;
