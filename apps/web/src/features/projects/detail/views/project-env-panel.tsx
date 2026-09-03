"use client";

import { FormEvent, useMemo, useState } from "react";

import { useCapabilities } from "@/features/capabilities/current";
import { useProjectEnvProvisioning } from "../view-models/use-project-env-provisioning-view-model";
import type {
  DeploymentTarget,
  EnvLane,
  EnvVarMetadata,
  ProvisionedProject,
  RenderRuntime,
} from "@/features/projects";
import { formatApiError } from "@/features/workflows";
import {
  envRowsInvalid,
  filterEnvMetadata,
  hostingForProject,
  isEnvKeyQuotaReached,
  knownTargetBranches,
  presentScopeOptions,
  resolveActiveTargetId,
  resolvePreviewScope,
} from "../model/env-panel-rules";
import type { EnvRow } from "../model/env-panel-rules";
import { EnvHostingSection } from "./env-hosting-section";
import { EnvProvisionedTable } from "./env-provisioned-table";
import { EnvVariablesForm } from "./env-variables-form";

interface ProjectEnvPanelProps {
  project: ProvisionedProject;
  onTargetCreated?: (target: DeploymentTarget) => void;
  section?: "all" | "hosting" | "variables";
}

export function ProjectEnvPanel({
  onTargetCreated,
  project,
  section = "all",
}: Readonly<ProjectEnvPanelProps>) {
  const {
    addTarget,
    loading,
    metadata,
    providerConnections,
    provision,
    removeMetadata,
    saving,
    targets,
    usageItems,
    validateEnvText,
  } = useProjectEnvProvisioning(project.id, project.status === "provisioned");
  const [targetId, setTargetId] = useState("");
  const [targetAction, setTargetAction] = useState<
    "create" | "register_existing"
  >("create");
  const { deploymentOwnershipMode: ownershipMode } = useCapabilities();
  const hosting = useMemo(() => hostingForProject(project), [project]);
  const provider = hosting.provider;
  const slot = hosting.slot;
  const [lane, setLane] = useState<EnvLane>("preview");
  const [previewBranch, setPreviewBranch] = useState("");
  const [projectName, setProjectName] = useState(`${project.serviceName}-uat`);
  const [providerProjectId, setProviderProjectId] = useState("");
  const [providerProjectName, setProviderProjectName] = useState(
    project.serviceName,
  );
  const [providerConnectionId, setProviderConnectionId] = useState("");
  const [branchName, setBranchName] = useState("uat");
  const [rootDirectory, setRootDirectory] = useState(".");
  const [buildCommand, setBuildCommand] = useState("npm ci && npm run build");
  const [startCommand, setStartCommand] = useState("npm run start:prod");
  const [renderRuntime, setRenderRuntime] = useState<RenderRuntime>("docker");
  const [rows, setRows] = useState<EnvRow[]>([{ key: "", value: "" }]);
  const [message, setMessage] = useState<string | null>(null);
  const [bulkEnvText, setBulkEnvText] = useState("");
  const [isAddingVariable, setIsAddingVariable] = useState(false);
  const [isBulkEnvDialogOpen, setIsBulkEnvDialogOpen] = useState(false);
  const [bulkValidation, setBulkValidation] = useState<
    Awaited<ReturnType<typeof validateEnvText>> | null
  >(null);
  const [filterTargetId, setFilterTargetId] = useState("all");
  const [filterEnvironment, setFilterEnvironment] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | EnvVarMetadata["status"]>(
    "all",
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeTargetId = resolveActiveTargetId(targetId, targets);
  const activeTarget = targets.find((target) => target.id === activeTargetId);
  const knownBranches = useMemo(() => knownTargetBranches(targets), [targets]);
  const activeScope = useMemo(
    () => resolvePreviewScope(lane, previewBranch, activeTarget?.branchName),
    [activeTarget?.branchName, lane, previewBranch],
  );
  const presentScopes = useMemo(() => presentScopeOptions(metadata), [metadata]);
  const matchingConnections = providerConnections.filter(
    (connection) => connection.provider === provider,
  );
  const activeProviderConnectionId =
    providerConnectionId || matchingConnections[0]?.id || "";
  const envKeyQuota = useMemo(
    () => usageItems.find((item) => item.code === "env_keys") ?? null,
    [usageItems],
  );
  const envKeyQuotaReached = isEnvKeyQuotaReached(envKeyQuota);
  const resourceUsageItems = useMemo(
    () => usageItems.filter((item) => item.limit > 0),
    [usageItems],
  );
  const invalid = useMemo(() => envRowsInvalid(rows), [rows]);
  const filteredMetadata = useMemo(
    () =>
      filterEnvMetadata(metadata, {
        targetId: filterTargetId,
        environment: filterEnvironment,
        status: filterStatus,
      }),
    [filterEnvironment, filterStatus, filterTargetId, metadata],
  );
  const showHosting = section !== "variables";
  const showVariables = section !== "hosting";

  async function handleSaveTarget() {
    setMessage(null);
    const targetPayload = {
      action: targetAction,
      slot,
      ownershipMode,
      provider,
      branchName,
      ...(ownershipMode === "byo"
        ? { providerConnectionId: activeProviderConnectionId }
        : {}),
      ...(targetAction === "create"
        ? {
            projectName,
            rootDirectory,
            buildCommand,
            ...(provider === "render" && startCommand ? { startCommand } : {}),
            ...(provider === "render"
              ? {
                  renderRuntime,
                  renderServiceType: "web_service" as const,
                  renderInstanceType: "free",
                }
              : {}),
          }
        : {
            providerProjectId,
            providerProjectName,
          }),
    } as const;
    try {
      const target = await addTarget(targetPayload);
      setTargetId(target.id);
      onTargetCreated?.(target);
      setMessage(
        targetAction === "create"
          ? "Deployment target created."
          : "Deployment target registered.",
      );
    } catch (error) {
      setMessage(formatApiError(error, "Deployment target setup failed"));
    }
  }

  async function handleProvision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    try {
      await provision({
        deploymentTargetId: activeTargetId,
        ...activeScope,
        vars: rows,
      });
      setRows([{ key: "", value: "" }]);
      setIsAddingVariable(false);
      setMessage("Environment variables provisioned.");
    } catch (error) {
      setMessage(
        formatApiError(error, "Environment variable provisioning failed"),
      );
    }
  }

  async function handleBulkValidate() {
    if (!activeTargetId) return;
    setMessage(null);
    try {
      const result = await validateEnvText({
        deploymentTargetId: activeTargetId,
        ...activeScope,
        text: bulkEnvText,
      });
      setBulkValidation(result);
      setBulkEnvText("");
      setMessage(
        `Parsed ${result.keyCount} env ${result.keyCount === 1 ? "line" : "lines"}. Values were cleared.`,
      );
    } catch (error) {
      setMessage(
        formatApiError(error, "Environment variable validation failed"),
      );
    }
  }

  function useParsedKeys() {
    if (!bulkValidation?.keys.length) return;
    setRows(bulkValidation.keys.map((key) => ({ key, value: "" })));
    setIsAddingVariable(true);
    setIsBulkEnvDialogOpen(false);
  }

  async function handleDeleteMetadata(item: EnvVarMetadata) {
    if (confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      setMessage(
        "Confirm delete to remove this key from the provider and ALPHACI metadata.",
      );
      return;
    }

    setMessage(null);
    try {
      await removeMetadata(item.id);
      setConfirmDeleteId(null);
      setMessage(`${item.key} deleted.`);
    } catch (error) {
      setMessage(formatApiError(error, "Environment variable delete failed"));
    }
  }

  function startReProvision(item: EnvVarMetadata) {
    setTargetId(item.deploymentTargetId);
    setLane(item.lane);
    setPreviewBranch(item.gitBranch ?? "");
    setRows([{ key: item.key, value: "" }]);
    setIsAddingVariable(true);
    setMessage(`Re-enter the value for ${item.key} before provisioning.`);
  }

  return (
    <div className="env-provisioning-panel">
      {showHosting ? (
        <EnvHostingSection
          activeProviderConnectionId={activeProviderConnectionId}
          branchName={branchName}
          buildCommand={buildCommand}
          hosting={hosting}
          matchingConnections={matchingConnections}
          message={message}
          onSaveTarget={() => void handleSaveTarget()}
          ownershipMode={ownershipMode}
          projectName={projectName}
          provider={provider}
          providerProjectId={providerProjectId}
          providerProjectName={providerProjectName}
          renderRuntime={renderRuntime}
          resourceUsageItems={resourceUsageItems}
          rootDirectory={rootDirectory}
          saving={saving}
          setBranchName={setBranchName}
          setBuildCommand={setBuildCommand}
          setProjectName={setProjectName}
          setProviderConnectionId={setProviderConnectionId}
          setProviderProjectId={setProviderProjectId}
          setProviderProjectName={setProviderProjectName}
          setRenderRuntime={setRenderRuntime}
          setRootDirectory={setRootDirectory}
          setStartCommand={setStartCommand}
          setTargetAction={setTargetAction}
          startCommand={startCommand}
          targetAction={targetAction}
          targets={targets}
        />
      ) : null}

      {showVariables && isAddingVariable ? (
        <EnvVariablesForm
          activeTarget={activeTarget}
          activeTargetId={activeTargetId}
          bulkEnvText={bulkEnvText}
          bulkValidation={bulkValidation}
          envKeyQuota={envKeyQuota}
          envKeyQuotaReached={envKeyQuotaReached}
          invalid={invalid}
          isBulkEnvDialogOpen={isBulkEnvDialogOpen}
          knownBranches={knownBranches}
          lane={lane}
          loading={loading}
          onBulkTextChange={setBulkEnvText}
          onBulkValidate={() => void handleBulkValidate()}
          onCancel={() => setIsAddingVariable(false)}
          onLaneChange={setLane}
          onOpenBulkDialog={() => setIsBulkEnvDialogOpen(true)}
          onPreviewBranchChange={setPreviewBranch}
          onProvision={(event) => void handleProvision(event)}
          onRowsChange={setRows}
          onTargetIdChange={setTargetId}
          onUseParsedKeys={useParsedKeys}
          previewBranch={previewBranch}
          rows={rows}
          saving={saving}
          setIsBulkEnvDialogOpen={setIsBulkEnvDialogOpen}
          targets={targets}
        />
      ) : null}

      {showVariables ? (
        <EnvProvisionedTable
          confirmDeleteId={confirmDeleteId}
          filterEnvironment={filterEnvironment}
          filterStatus={filterStatus}
          filterTargetId={filterTargetId}
          filteredMetadata={filteredMetadata}
          metadata={metadata}
          onDelete={(item) => void handleDeleteMetadata(item)}
          onFilterEnvironmentChange={setFilterEnvironment}
          onFilterStatusChange={setFilterStatus}
          onFilterTargetChange={setFilterTargetId}
          onReProvision={startReProvision}
          onStartAdd={() => setIsAddingVariable(true)}
          presentScopes={presentScopes}
          targets={targets}
        />
      ) : null}
    </div>
  );
}
