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
import {
  defaultProvisioningTarget,
  reseedTargets,
  sanitizeProvisioningTarget,
} from "../model/deployment-provisioning-rules";

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

/** The provisioning request as sent: empty variables dropped, targets trimmed. */
function hostedPayloadFor(request: DeploymentProvisioningRequest): DeploymentProvisioningRequest {
  const sharedEnv = sanitizedEnvSets(request.sharedEnv);
  const activeProviders = new Set(request.targets.map((target) => target.provider));
  const variableGroups = sanitizedVariableGroups(request.variableGroups, activeProviders);
  const targets = request.targets.map((target) => ({
    ...sanitizeProvisioningTarget(target),
    env: sanitizedEnvSets(target.env),
  }));
  return {
    ...request,
    enabled: true,
    ...(variableGroups.length ? { variableGroups } : { variableGroups: undefined }),
    ...(sharedEnv.length ? { sharedEnv } : { sharedEnv: undefined }),
    targets,
  };
}

/** The hosted targets a form starts with, and keeps named after the repository. */
export interface ProvisioningSeed {
  slot: EnvTargetSlot;
  projectName: string;
}

function seedKey(repoShapeId: string | undefined, seeds: readonly ProvisioningSeed[]): string {
  return `${repoShapeId ?? ""}|${seeds.map((seed) => `${seed.slot}:${seed.projectName}`).join(",")}`;
}

function initialTargets(
  repoShapeId: string | undefined,
  seeds: readonly ProvisioningSeed[] | undefined,
): DeploymentProvisioningTargetRequest[] {
  if (!seeds?.length) return [defaultProvisioningTarget("backend", "", repoShapeId)];
  return seeds.map((seed) => defaultProvisioningTarget(seed.slot, seed.projectName, repoShapeId));
}

export function useDeploymentProvisioningForm(
  repoShapeId?: string,
  options: {
    /**
     * The default targets for the current repository name, shape and stack.
     * When they change, the targets follow (see reseedTargets): what was typed
     * into a target is kept, and only a name nobody edited is renamed.
     */
    seeds?: readonly ProvisioningSeed[];
  } = {},
) {
  const { seeds } = options;
  const [enabled, setEnabled] = useState(false);
  const [request, setRequest] = useState<DeploymentProvisioningRequest>(() => ({
    enabled: false,
    targets: initialTargets(repoShapeId, seeds),
  }));
  const [seeded, setSeeded] = useState(() => ({
    key: seeds ? seedKey(repoShapeId, seeds) : "",
    seeds: seeds ?? [],
  }));

  // State derived from a changing input, applied while rendering.
  const nextKey = seeds ? seedKey(repoShapeId, seeds) : seeded.key;
  if (seeds && nextKey !== seeded.key) {
    const previous = seeded.seeds;
    setSeeded({ key: nextKey, seeds });
    setRequest((current) => ({
      ...current,
      targets: reseedTargets(current.targets, previous, seeds, repoShapeId),
    }));
  }

  function setDefaultTarget(slot: EnvTargetSlot, projectName: string) {
    setRequest({
      enabled: true,
      targets: [defaultProvisioningTarget(slot, projectName, repoShapeId)],
    });
    setEnabled(true);
  }

  function setDefaultTargets(
    targets: Array<{ slot: EnvTargetSlot; projectName: string }>,
  ) {
    setRequest({
      enabled: true,
      targets: targets.map((target) =>
        defaultProvisioningTarget(target.slot, target.projectName, repoShapeId),
      ),
    });
    setEnabled(true);
  }

  /** The request as sent when hosting is on, whether or not it is on now. */
  const hostedPayload = useMemo(() => hostedPayloadFor(request), [request]);
  const payload = enabled ? hostedPayload : undefined;

  const hostedRenderVariableCount = useMemo(
    () => countRenderVariables(hostedPayload.targets, hostedPayload.variableGroups ?? []),
    [hostedPayload],
  );
  const hostedRenderVariablesRequired = hostedPayload.targets.some(
    (target) => target.provider === "render",
  );
  /** Render deploys with no variable at all, were hosting on. */
  const hostedRenderVariablesMissing =
    hostedRenderVariablesRequired && hostedRenderVariableCount === 0;
  const renderVariableCount = enabled ? hostedRenderVariableCount : 0;
  const renderVariablesRequired = enabled && hostedRenderVariablesRequired;
  const renderVariablesMissing = enabled && hostedRenderVariablesMissing;

  return {
    enabled,
    hostedPayload,
    hostedRenderVariablesMissing,
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
