"use client";

import { useEffect, useMemo } from "react";

import type {
  DeploymentProvisioningEnvSet,
  DeploymentProvisioningRequest,
  DeploymentProvisioningTargetRequest,
  DeploymentProvisioningVariableGroup,
  EnvLane,
  EnvOwnershipMode,
  EnvProvider,
  ProviderConnection,
} from "@/shared/api/contracts";
import {
  addVariableGroup,
  blankEnvSet,
  countVars,
  envVarsForDisplay,
  fallbackTarget,
  lanes,
  laneLabel,
  providerLabel,
  removeVariableGroup,
  targetBranchKey,
  targetBranchLabel,
  targetScopeIncludes,
  toggleGroupTargetBranch,
  updateEnvVar,
  updateVariableGroupAt,
  variableGroupsForValue,
} from "../model/deployment-provisioning-rules";
import { useProviderConnections } from "../view-models/use-provider-connections";
import { DeploymentTargetCard } from "./deployment-target-card";

interface DeploymentProvisioningSetupProps {
  repoShape: string;
  selectedProjectKind?: "frontend" | "backend";
  /**
   * Ownership mode this deployment offers (from capabilities). BYO is
   * archived, so this defaults to 'flowci_managed': deployments centralize on
   * the platform's Render/Vercel and the bring-your-own provider-connection
   * UI stays hidden.
   */
  ownershipMode?: EnvOwnershipMode;
  value: DeploymentProvisioningRequest;
  onChange: (value: DeploymentProvisioningRequest) => void;
}

interface TargetOption {
  key: string;
  label: string;
  provider: EnvProvider;
}

function RemoveIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** Picks a saved provider connection for every BYO target that has none yet. */
function useByoConnectionDefaults(input: {
  targets: DeploymentProvisioningTargetRequest[];
  value: DeploymentProvisioningRequest;
  onChange: (value: DeploymentProvisioningRequest) => void;
}) {
  const { targets, value, onChange } = input;
  const needsProviderConnections = targets.some((target) => target.ownershipMode === "byo");
  const { connections, loading } = useProviderConnections(needsProviderConnections);
  const activeConnections = useMemo(
    () => connections.filter((connection) => connection.status === "active"),
    [connections],
  );

  useEffect(() => {
    if (!needsProviderConnections || loading) return;
    let changed = false;
    const nextTargets = targets.map((target) => {
      const nextId = defaultConnectionId(target, activeConnections);
      if (nextId === target.providerConnectionId) return target;
      changed = true;
      return { ...target, providerConnectionId: nextId };
    });
    if (changed) onChange({ ...value, targets: nextTargets });
  }, [activeConnections, loading, needsProviderConnections, onChange, targets, value]);

  return { activeConnections, loading };
}

function defaultConnectionId(
  target: DeploymentProvisioningTargetRequest,
  connections: ProviderConnection[],
): string | undefined {
  if (target.ownershipMode !== "byo") return target.providerConnectionId;
  const matching = connections.filter((connection) => connection.provider === target.provider);
  if (matching.some((connection) => connection.id === target.providerConnectionId)) {
    return target.providerConnectionId;
  }
  return matching[0]?.id;
}

/**
 * The Vercel / Render hosting targets: one card per target with the fields
 * that take effect (name, region and instance for Render, the target's own
 * variables), then optional shared defaults, collapsed until opened.
 */
export function DeploymentProvisioningSetup({
  repoShape,
  selectedProjectKind,
  ownershipMode = "flowci_managed",
  value,
  onChange,
}: Readonly<DeploymentProvisioningSetupProps>) {
  const targets = useMemo(
    () =>
      value.targets.length > 0
        ? value.targets
        : [fallbackTarget(selectedProjectKind, ownershipMode)],
    [ownershipMode, selectedProjectKind, value.targets],
  );
  const connections = useByoConnectionDefaults({ targets, value, onChange });

  return (
    <div className="deployment-provisioning-setup" data-testid="setup-hosted-targets">
      {targets.map((target, targetIndex) => (
        <DeploymentTargetCard
          key={`${target.slot}-${targetIndex}`}
          onChange={onChange}
          ownershipMode={ownershipMode}
          providerConnections={connections.activeConnections}
          providerConnectionsLoading={connections.loading}
          repoShape={repoShape}
          target={target}
          targetIndex={targetIndex}
          value={value}
        />
      ))}
      <SharedDefaults targets={targets} value={value} onChange={onChange} />
    </div>
  );
}

/**
 * Variable groups sent to more than one target. Optional, and collapsed by
 * default: most projects only need each card's own variables.
 */
function SharedDefaults({
  targets,
  value,
  onChange,
}: Readonly<{
  targets: DeploymentProvisioningTargetRequest[];
  value: DeploymentProvisioningRequest;
  onChange: (value: DeploymentProvisioningRequest) => void;
}>) {
  const targetProviders = [...new Set(targets.map((target) => target.provider))];
  const variableGroups = variableGroupsForValue(value, targetProviders);
  // A provider's groups stay visible even when no target uses it any more, so
  // editing a target never makes groups silently disappear.
  const displayProviders = [
    ...new Set([...targetProviders, ...variableGroups.map((group) => group.provider)]),
  ];
  const targetOptions: TargetOption[] = targets.map((target) => ({
    key: targetBranchKey(target),
    label: targetBranchLabel(target),
    provider: target.provider,
  }));
  const groupVarCount = variableGroups.reduce((total, group) => total + countVars(group.env), 0);

  return (
    <details className="wizard-shared-defaults">
      <summary>
        <span className="wizard-shared-defaults__title">Shared defaults</span>
        <span className="wizard-shared-defaults__meta">
          Optional · {variableGroups.length} group{variableGroups.length === 1 ? "" : "s"},{" "}
          {groupVarCount} variable{groupVarCount === 1 ? "" : "s"}
        </span>
      </summary>
      <div className="wizard-shared-defaults__body">
        <div className="env-section-header">
          <p className="wizard-field__hint">
            Use this only when the same key should be sent to more than one target.
          </p>
          <div className="deployment-variable-actions">
            {targetProviders.map((provider) => (
              <button
                type="button"
                className="ghost-button deployment-variable-panel__button"
                key={provider}
                onClick={() => onChange(addVariableGroup(value, variableGroups, provider))}
              >
                Add {providerLabel(provider)} group
              </button>
            ))}
          </div>
        </div>
        {displayProviders.map((provider) => (
          <ProviderGroups
            key={provider}
            provider={provider}
            providerTargets={targetOptions.filter((option) => option.provider === provider)}
            variableGroups={variableGroups}
            value={value}
            onChange={onChange}
          />
        ))}
      </div>
    </details>
  );
}

function ProviderGroups({
  provider,
  providerTargets,
  variableGroups,
  value,
  onChange,
}: Readonly<{
  provider: EnvProvider;
  providerTargets: TargetOption[];
  variableGroups: DeploymentProvisioningVariableGroup[];
  value: DeploymentProvisioningRequest;
  onChange: (value: DeploymentProvisioningRequest) => void;
}>) {
  const providerGroups = variableGroups
    .map((group, groupIndex) => ({ group, groupIndex }))
    .filter(({ group }) => group.provider === provider);
  if (providerGroups.length === 0) return null;
  const label = providerLabel(provider);
  return (
    <div className="deployment-provider-groups">
      <div className="deployment-provider-groups__header">
        <div>
          <strong>{label} shared defaults</strong>
          <p className="wizard-field__hint">
            Available to {providerTargets.length} {label} target
            {providerTargets.length === 1 ? "" : "s"} unless you narrow the scope.
          </p>
        </div>
      </div>
      {providerTargets.length === 0 ? (
        <p className="env-orphan-warning">
          No {label} target uses this provider anymore. These groups will not be
          applied until a {label} target is added, or remove them below.
        </p>
      ) : null}
      {providerGroups.map(({ group, groupIndex }) => (
        <VariableGroupPanel
          key={`group-${groupIndex}`}
          group={group}
          groupIndex={groupIndex}
          onlyGroup={providerGroups.length === 1}
          provider={provider}
          providerTargets={providerTargets}
          variableGroups={variableGroups}
          value={value}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

interface GroupPanelProps {
  group: DeploymentProvisioningVariableGroup;
  groupIndex: number;
  onlyGroup: boolean;
  provider: EnvProvider;
  providerTargets: TargetOption[];
  variableGroups: DeploymentProvisioningVariableGroup[];
  value: DeploymentProvisioningRequest;
  onChange: (value: DeploymentProvisioningRequest) => void;
}

function scopedTargetBranches(
  appliesTo: "all" | "selected",
  group: DeploymentProvisioningVariableGroup,
  providerTargetKeys: string[],
): string[] | undefined {
  if (appliesTo !== "selected") return undefined;
  if (!group.targetBranches?.length) return providerTargetKeys;
  return group.targetBranches.filter((targetKey) => providerTargetKeys.includes(targetKey));
}

function VariableGroupPanel(props: Readonly<GroupPanelProps>) {
  const { group, groupIndex, onlyGroup, provider, variableGroups, value, onChange } = props;
  const envSet = group.env[0] ?? blankEnvSet();
  const sharedVars = envVarsForDisplay(envSet);
  const label = providerLabel(provider);
  const update = (next: DeploymentProvisioningVariableGroup) =>
    onChange(updateVariableGroupAt(value, variableGroups, groupIndex, next));
  const updateEnv = (next: DeploymentProvisioningEnvSet) => update({ ...group, env: [next] });
  const blankOnly = sharedVars.length === 1 && !sharedVars[0]?.key && !sharedVars[0]?.value;

  return (
    <div className="deployment-variable-panel">
      <div className="deployment-variable-panel__title-row">
        <label className="deployment-variable-panel__scope">
          <span>Name</span>
          <input
            aria-label={`Variable group name ${groupIndex + 1}`}
            value={group.name ?? `${label} variable group ${groupIndex + 1}`}
            onChange={(event) => update({ ...group, name: event.target.value })}
          />
        </label>
        <button
          type="button"
          className="env-var-row__remove env-var-remove"
          aria-label={`Remove variable group ${groupIndex + 1}`}
          disabled={onlyGroup && blankOnly}
          onClick={() => onChange(removeVariableGroup(value, variableGroups, groupIndex))}
        >
          <RemoveIcon />
        </button>
      </div>
      <GroupScopeRow {...props} envSet={envSet} sharedVars={sharedVars} updateEnv={updateEnv} />
      <GroupTargets {...props} />
      {sharedVars.map((variable, variableIndex) => (
        <GroupVariableRow
          key={`group-${groupIndex}-${variableIndex}`}
          envSet={envSet}
          groupIndex={groupIndex}
          sharedVars={sharedVars}
          updateEnv={updateEnv}
          variable={variable}
          variableIndex={variableIndex}
        />
      ))}
    </div>
  );
}

function GroupScopeRow({
  envSet,
  group,
  groupIndex,
  provider,
  providerTargets,
  sharedVars,
  updateEnv,
  variableGroups,
  value,
  onChange,
}: Readonly<
  GroupPanelProps & {
    envSet: DeploymentProvisioningEnvSet;
    sharedVars: Array<{ key: string; value: string }>;
    updateEnv: (next: DeploymentProvisioningEnvSet) => void;
  }
>) {
  const label = providerLabel(provider);
  const providerTargetKeys = providerTargets.map((target) => target.key);
  return (
    <div className="deployment-variable-panel__scope-row">
      <label className="deployment-variable-panel__environment">
        <span>Where used</span>
        <select
          aria-label={`Variable group scope ${groupIndex + 1}`}
          value={group.appliesTo ?? "all"}
          onChange={(event) => {
            const appliesTo = event.target.value as "all" | "selected";
            onChange(
              updateVariableGroupAt(value, variableGroups, groupIndex, {
                ...group,
                appliesTo,
                targetBranches: scopedTargetBranches(appliesTo, group, providerTargetKeys),
              }),
            );
          }}
        >
          <option value="all">Every {label} target</option>
          <option value="selected">Selected {label} targets</option>
        </select>
      </label>
      <label className="deployment-variable-panel__environment">
        <span>Applies to</span>
        <select
          aria-label={`Variable group environment ${groupIndex + 1}`}
          value={envSet.lane}
          onChange={(event) => updateEnv({ ...envSet, lane: event.target.value as EnvLane })}
        >
          {lanes.map((lane) => (
            <option key={lane} value={lane}>
              {laneLabel(lane)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="ghost-button deployment-variable-panel__button"
        onClick={() => updateEnv({ ...envSet, vars: [...sharedVars, { key: "", value: "" }] })}
      >
        Add key
      </button>
    </div>
  );
}

function GroupTargets({
  group,
  groupIndex,
  provider,
  providerTargets,
  variableGroups,
  value,
  onChange,
}: Readonly<GroupPanelProps>) {
  const label = providerLabel(provider);
  const providerTargetKeys = providerTargets.map((target) => target.key);
  return (
    <div
      className="deployment-variable-panel__targets"
      aria-label={`Variable group targets ${groupIndex + 1}`}
    >
      <span>
        {group.appliesTo === "selected" ? `Selected ${label} targets` : `Every ${label} target`}
      </span>
      <div className="deployment-flow-branches">
        {providerTargets.map((option) => (
          <button
            type="button"
            className={[
              "deployment-flow-branch",
              "deployment-flow-branch--button",
              targetScopeIncludes(group, option.key) ? "active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
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
  );
}

function GroupVariableRow({
  envSet,
  groupIndex,
  sharedVars,
  updateEnv,
  variable,
  variableIndex,
}: Readonly<{
  envSet: DeploymentProvisioningEnvSet;
  groupIndex: number;
  sharedVars: Array<{ key: string; value: string }>;
  updateEnv: (next: DeploymentProvisioningEnvSet) => void;
  variable: { key: string; value: string };
  variableIndex: number;
}>) {
  const position = `${groupIndex + 1}-${variableIndex + 1}`;
  return (
    <div className="env-var-row">
      <label>
        <span>Key</span>
        <input
          aria-label={`Group variable key ${position}`}
          value={variable.key}
          onChange={(event) =>
            updateEnv(updateEnvVar(envSet, variableIndex, { key: event.target.value.toUpperCase() }))
          }
          placeholder="DATABASE_URL"
        />
      </label>
      <label>
        <span>Value</span>
        <input
          aria-label={`Group variable value ${position}`}
          type="password"
          autoComplete="off"
          value={variable.value}
          onChange={(event) =>
            updateEnv(updateEnvVar(envSet, variableIndex, { value: event.target.value }))
          }
          placeholder="value"
        />
      </label>
      <button
        type="button"
        className="env-var-row__remove env-var-remove"
        aria-label={`Remove group variable ${position}`}
        disabled={sharedVars.length === 1 && !variable.key && !variable.value}
        onClick={() => {
          const nextVars = sharedVars.filter((_, currentIndex) => currentIndex !== variableIndex);
          updateEnv({ ...envSet, vars: nextVars.length ? nextVars : [{ key: "", value: "" }] });
        }}
      >
        <RemoveIcon />
      </button>
    </div>
  );
}
