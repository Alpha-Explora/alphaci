"use client";

import { useMemo, useState } from "react";

import { useCapabilities } from "@/features/capabilities/current";
import { useProjectEnvProvisioning } from "../view-models/use-project-env-provisioning-view-model";
import { useEnvVariablesEditor } from "../view-models/use-env-variables-editor-view-model";
import type {
  DeploymentTarget,
  EnvVarMetadata,
  ProvisionedProject,
  RenderRuntime,
} from "@/features/projects";
import { formatApiError } from "@/features/workflows";
import {
  filterEnvMetadata,
  hostingForProject,
  presentScopeOptions,
} from "../model/env-panel-rules";
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
  const env = useProjectEnvProvisioning(
    project.id,
    project.status === "provisioned",
    section !== "hosting",
  );
  const { addTarget, loading, metadata, providerConnections, saving, targets, usageItems } = env;
  const editor = useEnvVariablesEditor(env);
  const [targetAction, setTargetAction] = useState<
    "create" | "register_existing"
  >("create");
  const { deploymentOwnershipMode: ownershipMode } = useCapabilities();
  const hosting = useMemo(() => hostingForProject(project), [project]);
  const provider = hosting.provider;
  const slot = hosting.slot;
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
  const [filterTargetId, setFilterTargetId] = useState("all");
  const [filterEnvironment, setFilterEnvironment] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | EnvVarMetadata["status"]>(
    "all",
  );

  const presentScopes = useMemo(() => presentScopeOptions(metadata), [metadata]);
  const matchingConnections = providerConnections.filter(
    (connection) => connection.provider === provider,
  );
  const activeProviderConnectionId =
    providerConnectionId || matchingConnections[0]?.id || "";
  const resourceUsageItems = useMemo(
    () => usageItems.filter((item) => item.limit > 0),
    [usageItems],
  );
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
    editor.setMessage(null);
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
      editor.setTargetId(target.id);
      onTargetCreated?.(target);
      editor.setMessage(
        targetAction === "create"
          ? "Deployment target created."
          : "Deployment target registered.",
      );
    } catch (error) {
      editor.setMessage(formatApiError(error, "Deployment target setup failed"));
    }
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
          message={editor.message}
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

      {showVariables && editor.isAddingVariable ? (
        <EnvVariablesForm
          activeTarget={editor.activeTarget}
          activeTargetId={editor.activeTargetId}
          bulkEnvText={editor.bulkEnvText}
          bulkValidation={editor.bulkValidation}
          envKeyQuota={editor.envKeyQuota}
          envKeyQuotaReached={editor.envKeyQuotaReached}
          invalid={editor.invalid}
          isBulkEnvDialogOpen={editor.isBulkEnvDialogOpen}
          knownBranches={editor.knownBranches}
          lane={editor.lane}
          loading={loading}
          onBulkTextChange={editor.setBulkEnvText}
          onBulkValidate={() => void editor.bulkValidate()}
          onCancel={() => editor.setIsAddingVariable(false)}
          onLaneChange={editor.setLane}
          onOpenBulkDialog={() => editor.setIsBulkEnvDialogOpen(true)}
          onPreviewBranchChange={editor.setPreviewBranch}
          onProvision={(event) => void editor.provision(event)}
          onRowsChange={editor.setRows}
          onTargetIdChange={editor.setTargetId}
          onUseParsedKeys={editor.applyParsedKeys}
          previewBranch={editor.previewBranch}
          rows={editor.rows}
          saving={saving}
          setIsBulkEnvDialogOpen={editor.setIsBulkEnvDialogOpen}
          targets={targets}
        />
      ) : null}

      {showVariables ? (
        <EnvProvisionedTable
          confirmDeleteId={editor.confirmDeleteId}
          filterEnvironment={filterEnvironment}
          filterStatus={filterStatus}
          filterTargetId={filterTargetId}
          filteredMetadata={filteredMetadata}
          metadata={metadata}
          onDelete={(item) => void editor.deleteMetadata(item)}
          onFilterEnvironmentChange={setFilterEnvironment}
          onFilterStatusChange={setFilterStatus}
          onFilterTargetChange={setFilterTargetId}
          onReProvision={editor.startReProvision}
          onStartAdd={() => editor.setIsAddingVariable(true)}
          presentScopes={presentScopes}
          targets={targets}
        />
      ) : null}
    </div>
  );
}
