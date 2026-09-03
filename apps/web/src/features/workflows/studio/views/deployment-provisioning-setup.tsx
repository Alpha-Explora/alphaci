"use client";

import { useEffect, useMemo } from "react";

import type {
  DeploymentProvisioningRequest,
  EnvLane,
  EnvOwnershipMode,
} from "@/shared/api/contracts";
import {
  activeBranch,
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
  enabled: boolean;
  repoShape: string;
  showToggle?: boolean;
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
  onEnabledChange?: (enabled: boolean) => void;
}

export function DeploymentProvisioningSetup({
  enabled,
  repoShape,
  selectedProjectKind,
  ownershipMode = "flowci_managed",
  value,
  onChange,
  onEnabledChange,
}: Readonly<DeploymentProvisioningSetupProps>) {
  const targets = useMemo(
    () =>
      value.targets.length > 0
        ? value.targets
        : [fallbackTarget(selectedProjectKind, ownershipMode)],
    [ownershipMode, selectedProjectKind, value.targets],
  );
  const needsProviderConnections =
    enabled && targets.some((target) => target.ownershipMode === "byo");
  const {
    connections: providerConnections,
    loading: providerConnectionsLoading,
  } = useProviderConnections(needsProviderConnections);
  const activeProviderConnections = useMemo(
    () =>
      providerConnections.filter(
        (connection) => connection.status === "active",
      ),
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
  // Always show a provider's group block when either a target uses that provider
  // OR a group already exists for it. Without this, editing a target's provider
  // would orphan previously-created groups and make them silently disappear.
  const displayProviders = useMemo(
    () => [
      ...new Set([
        ...targetProviders,
        ...variableGroups.map((group) => group.provider),
      ]),
    ],
    [targetProviders, variableGroups],
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
  const groupVarCount = variableGroups.reduce(
    (total, group) => total + countVars(group.env),
    0,
  );
  const branchVarCount = targets.reduce(
    (total, target) => total + countVars(target.env),
    0,
  );

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

      const nextConnectionId = matchingConnections[0]?.id;
      if (target.providerConnectionId === nextConnectionId) {
        return target;
      }

      changed = true;
      return {
        ...target,
        providerConnectionId: nextConnectionId,
      };
    });

    if (changed) {
      onChange({ ...value, targets: nextTargets });
    }
  }, [
    activeProviderConnections,
    enabled,
    onChange,
    providerConnectionsLoading,
    targets,
    value,
  ]);

  return (
    <div className="deployment-provisioning-setup">
      <div className="deployment-provisioning-setup__header">
        <div>
          <span className="controls-panel-label">Deployment provisioning</span>
          <p className="helper-text" style={{ margin: "0.35rem 0 0" }}>
            Create the hosting target and add only the variables needed for the
            first deploy.
          </p>
        </div>
        <label className="toggle-row toggle-switch-row">
          <input
            type="checkbox"
            className="toggle-switch-input"
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
          <span className="toggle-switch-track" aria-hidden="true">
            <span className="toggle-switch-thumb" />
          </span>
          <span>Provision deployment target</span>
        </label>
      </div>

      {enabled ? (
        <div className="deployment-provisioning-setup__body">
          <section
            className="deployment-provisioning-flow"
            aria-label="Deployment provisioning flow"
          >
            <div className="deployment-flow-step">
              <span className="deployment-flow-step__index">1</span>
              <div>
                <strong>Hosting targets</strong>
                <div className="deployment-flow-branches">
                  {targets.map((target, targetIndex) => (
                    <span
                      className="deployment-flow-branch"
                      key={`${target.slot}-${targetIndex}`}
                    >
                      {target.slot} / {target.provider} /{" "}
                      {activeBranch(target.branchName)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="deployment-flow-step">
              <span className="deployment-flow-step__index">2</span>
              <div>
                <strong>Target variables</strong>
                <span>
                  {branchVarCount} variable{branchVarCount === 1 ? "" : "s"}{" "}
                  on a specific service
                </span>
              </div>
            </div>
            <div className="deployment-flow-step">
              <span className="deployment-flow-step__index">3</span>
              <div>
                <strong>Shared defaults</strong>
                <span>
                  Optional. {variableGroups.length} group
                  {variableGroups.length === 1 ? "" : "s"} / {groupVarCount}{" "}
                  variable{groupVarCount === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </section>

          <section className="env-provisioning-section deployment-variable-groups">
            <div className="env-section-header">
              <div>
                <h4>Shared defaults</h4>
                <p className="helper-text" style={{ margin: "0.25rem 0 0" }}>
                  Optional. Use this only when the same key should be sent to
                  more than one target.
                </p>
              </div>
              <div className="deployment-variable-actions">
                {targetProviders.map((provider) => (
                  <button
                    type="button"
                    className="ghost-button deployment-variable-panel__button"
                    key={provider}
                    onClick={() =>
                      onChange(
                        addVariableGroup(value, variableGroups, provider),
                      )
                    }
                  >
                    Add {providerLabel(provider)} group
                  </button>
                ))}
              </div>
            </div>

            {variableGroups.length === 0 ? (
              <div className="env-empty-state deployment-variable-empty">
                <strong>Most projects can skip this.</strong>
                <span>
                  Add target variables inside each service card below when a
                  value belongs to only one backend or frontend.
                </span>
              </div>
            ) : null}

            {displayProviders.map((provider) => {
              const providerTargets = targetBranchOptions.filter(
                (option) => option.provider === provider,
              );
              const providerGroups = variableGroups
                .map((group, groupIndex) => ({ group, groupIndex }))
                .filter(({ group }) => group.provider === provider);
              const hasTargets = providerTargets.length > 0;
              if (providerGroups.length === 0) {
                return null;
              }
              return (
                <div className="deployment-provider-groups" key={provider}>
                  <div className="deployment-provider-groups__header">
                    <div>
                      <strong>{providerLabel(provider)} shared defaults</strong>
                      <p
                        className="helper-text"
                        style={{ margin: "0.25rem 0 0" }}
                      >
                        Available to {providerTargets.length}{" "}
                        {providerLabel(provider)} target
                        {providerTargets.length === 1 ? "" : "s"} unless you
                        narrow the scope.
                      </p>
                    </div>
                  </div>

                  {!hasTargets && providerGroups.length > 0 ? (
                    <p className="env-orphan-warning">
                      No {providerLabel(provider)} target uses this provider
                      anymore. These groups will not be applied until a{" "}
                      {providerLabel(provider)} target is added, or remove them
                      below.
                    </p>
                  ) : null}

                  {providerGroups.map(({ group, groupIndex }) => {
                    const envSet = group.env[0] ?? blankEnvSet();
                    const sharedVars = envVarsForDisplay(envSet);
                    const providerTargetKeys = providerTargets.map(
                      (target) => target.key,
                    );

                    return (
                      <div
                        className="deployment-variable-panel"
                        key={`group-${groupIndex}`}
                      >
                        <div className="deployment-variable-panel__title-row">
                          <label className="deployment-variable-panel__scope">
                            <span>Name</span>
                            <input
                              aria-label={`Variable group name ${groupIndex + 1}`}
                              value={
                                group.name ??
                                `${providerLabel(provider)} variable group ${groupIndex + 1}`
                              }
                              onChange={(event) =>
                                onChange(
                                  updateVariableGroupAt(
                                    value,
                                    variableGroups,
                                    groupIndex,
                                    {
                                      ...group,
                                      name: event.target.value,
                                    },
                                  ),
                                )
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="env-var-row__remove env-var-remove"
                            aria-label={`Remove variable group ${groupIndex + 1}`}
                            disabled={
                              providerGroups.length === 1 &&
                              sharedVars.length === 1 &&
                              !sharedVars[0]?.key &&
                              !sharedVars[0]?.value
                            }
                            onClick={() =>
                              onChange(
                                removeVariableGroup(
                                  value,
                                  variableGroups,
                                  groupIndex,
                                ),
                              )
                            }
                          >
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
                          </button>
                        </div>
                        <div className="deployment-variable-panel__scope-row">
                          <label className="deployment-variable-panel__environment">
                            <span>Where used</span>
                            <select
                              aria-label={`Variable group scope ${groupIndex + 1}`}
                              value={group.appliesTo ?? "all"}
                              onChange={(event) =>
                                onChange(
                                  updateVariableGroupAt(
                                    value,
                                    variableGroups,
                                    groupIndex,
                                    {
                                      ...group,
                                      appliesTo: event.target.value as
                                        "all" | "selected",
                                      targetBranches:
                                        event.target.value === "selected"
                                          ? group.targetBranches?.length
                                            ? group.targetBranches.filter(
                                                (targetKey) =>
                                                  providerTargetKeys.includes(
                                                    targetKey,
                                                  ),
                                              )
                                            : providerTargetKeys
                                          : undefined,
                                    },
                                  ),
                                )
                              }
                            >
                              <option value="all">
                                Every {providerLabel(provider)} target
                              </option>
                              <option value="selected">
                                Selected {providerLabel(provider)} targets
                              </option>
                            </select>
                          </label>
                          <label className="deployment-variable-panel__environment">
                            <span>Environment</span>
                            <select
                              aria-label={`Variable group environment ${groupIndex + 1}`}
                              value={envSet.lane}
                              onChange={(event) =>
                                onChange(
                                  updateVariableGroupAt(
                                    value,
                                    variableGroups,
                                    groupIndex,
                                    {
                                      ...group,
                                      env: [
                                        {
                                          ...envSet,
                                          lane: event.target
                                            .value as EnvLane,
                                        },
                                      ],
                                    },
                                  ),
                                )
                              }
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
                            onClick={() =>
                              onChange(
                                updateVariableGroupAt(
                                  value,
                                  variableGroups,
                                  groupIndex,
                                  {
                                    ...group,
                                    env: [
                                      {
                                        ...envSet,
                                        vars: [
                                          ...sharedVars,
                                          { key: "", value: "" },
                                        ],
                                      },
                                    ],
                                  },
                                ),
                              )
                            }
                          >
                            Add key
                          </button>
                        </div>

                        <div
                          className="deployment-variable-panel__targets"
                          aria-label={`Variable group targets ${groupIndex + 1}`}
                        >
                          <span>
                            {group.appliesTo === "selected"
                              ? `Selected ${providerLabel(provider)} targets`
                              : `Every ${providerLabel(provider)} target`}
                          </span>
                          <div className="deployment-flow-branches">
                            {providerTargets.map((option) => (
                              <button
                                type="button"
                                className={[
                                  "deployment-flow-branch",
                                  "deployment-flow-branch--button",
                                  targetScopeIncludes(group, option.key)
                                    ? "active"
                                    : "",
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
                                      toggleGroupTargetBranch(
                                        group,
                                        option.key,
                                        providerTargetKeys,
                                      ),
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
                          <div
                            className="env-var-row"
                            key={`group-${groupIndex}-${variableIndex}`}
                          >
                            <label>
                              <span>Key</span>
                              <input
                                aria-label={`Group variable key ${groupIndex + 1}-${variableIndex + 1}`}
                                value={variable.key}
                                onChange={(event) => {
                                  const nextEnvSet = updateEnvVar(
                                    envSet,
                                    variableIndex,
                                    { key: event.target.value.toUpperCase() },
                                  );
                                  onChange(
                                    updateVariableGroupAt(
                                      value,
                                      variableGroups,
                                      groupIndex,
                                      { ...group, env: [nextEnvSet] },
                                    ),
                                  );
                                }}
                                placeholder="DATABASE_URL"
                              />
                            </label>
                            <label>
                              <span>Value</span>
                              <input
                                aria-label={`Group variable value ${groupIndex + 1}-${variableIndex + 1}`}
                                type="password"
                                autoComplete="off"
                                value={variable.value}
                                onChange={(event) => {
                                  const nextEnvSet = updateEnvVar(
                                    envSet,
                                    variableIndex,
                                    { value: event.target.value },
                                  );
                                  onChange(
                                    updateVariableGroupAt(
                                      value,
                                      variableGroups,
                                      groupIndex,
                                      { ...group, env: [nextEnvSet] },
                                    ),
                                  );
                                }}
                                placeholder="value"
                              />
                            </label>
                            <button
                              type="button"
                              className="env-var-row__remove env-var-remove"
                              aria-label={`Remove group variable ${groupIndex + 1}-${variableIndex + 1}`}
                              disabled={
                                sharedVars.length === 1 &&
                                !variable.key &&
                                !variable.value
                              }
                              onClick={() => {
                                const nextVars = sharedVars.filter(
                                  (_, currentIndex) =>
                                    currentIndex !== variableIndex,
                                );
                                onChange(
                                  updateVariableGroupAt(
                                    value,
                                    variableGroups,
                                    groupIndex,
                                    {
                                      ...group,
                                      env: [
                                        {
                                          ...envSet,
                                          vars: nextVars.length
                                            ? nextVars
                                            : [{ key: "", value: "" }],
                                        },
                                      ],
                                    },
                                  ),
                                );
                              }}
                            >
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

          {targets.map((target, targetIndex) => (
            <DeploymentTargetCard
              key={`${target.slot}-${targetIndex}`}
              onChange={onChange}
              ownershipMode={ownershipMode}
              providerConnections={activeProviderConnections}
              providerConnectionsLoading={providerConnectionsLoading}
              repoShape={repoShape}
              target={target}
              targetIndex={targetIndex}
              value={value}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
