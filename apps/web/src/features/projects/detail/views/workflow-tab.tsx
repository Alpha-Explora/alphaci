"use client";

import { motion } from "framer-motion";

import { HelpTip } from "@/shared/ui/help-tip";
import type {
  DeploymentTarget,
  ProvisionedProject,
  WorkflowFileMetadata,
  WorkflowSettings,
  WorkflowSettingsPreviewResponse,
} from "@/features/projects";
import { isPullRequestRole } from "../model/pull-request-compose-rules";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { WorkflowStageList } from "./workflow-stage-list";
import {
  COVERAGE_THRESHOLD_OPTIONS,
  WORKFLOW_CHECK_OPTIONS,
  centralRefIsListed,
  coverageHasPreset,
  createUpdatePrLabel,
  UPDATE_PR_ROLE_NOTE,
  UPDATE_PR_TARGET_NOTE,
  previewDiffBadgeClass,
  previewWorkflowLabel,
} from "../model/project-detail-tab-rules";

export function WorkflowTab({
  vm,
}: Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  dangerZone?: React.ReactNode;
}>) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
      }}
    >
      <WorkflowSettingsPanel
        enabled={workflowSettingsVisible(vm)}
        targets={vm.deploymentTargets}
        workflow={vm.workflow}
        workflowUpdatePrEnabled={vm.workflowUpdatePrEnabled}
        canCreateUpdatePr={isPullRequestRole(vm.appRole)}
      />
      <WorkflowFiles files={vm.workflowFiles} />
    </div>
  );
}

function workflowSettingsVisible(vm: ProjectDetailTabsViewModel): boolean {
  return (
    vm.workflowSettingsPreviewEnabled &&
    vm.overview?.capabilities.workflowSettings === true
  );
}

function WorkflowFiles({
  files,
}: Readonly<{ files: WorkflowFileMetadata[] }>) {
  if (files.length) {
    return <WorkflowStageList files={files} />;
  }
  return (
    <p className="env-empty-state">
      No workflow file metadata is tracked yet.
    </p>
  );
}

function WorkflowSettingsPanel({
  enabled,
  targets,
  workflow,
  workflowUpdatePrEnabled,
  canCreateUpdatePr,
}: Readonly<{
  enabled: boolean;
  targets: DeploymentTarget[];
  workflow: ProjectDetailTabsViewModel["workflow"];
  workflowUpdatePrEnabled: boolean;
  canCreateUpdatePr: boolean;
}>) {
  if (!enabled) return null;
  return (
    <div
      className="glass-panel"
      style={{
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
      }}
    >
      <WorkflowSettingsHeader workflow={workflow} />
      <WorkflowSettingsFields workflow={workflow} />
      <WorkflowChecksField workflow={workflow} />
      <WorkflowDeployMappings targets={targets} />
      <WorkflowError message={workflow.settingsError} />
      <WorkflowPreviewWarnings preview={workflow.preview} />
      <WorkflowPreviewResult
        preview={workflow.preview}
        workflow={workflow}
        workflowUpdatePrEnabled={workflowUpdatePrEnabled}
        canCreateUpdatePr={canCreateUpdatePr}
      />
    </div>
  );
}

function WorkflowSettingsHeader({
  workflow,
}: Readonly<{ workflow: ProjectDetailTabsViewModel["workflow"] }>) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "0.75rem",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <div>
        <h4 style={{ margin: 0, fontSize: "0.95rem" }}>Workflow settings</h4>
        <p
          style={{
            margin: "0.25rem 0 0",
            color: "var(--text-secondary)",
            fontSize: "0.78rem",
          }}
        >
          Preview only
        </p>
      </div>
      <button
        className="ghost-button"
        type="button"
        disabled={!workflow.settings || workflow.previewing}
        onClick={() => void workflow.previewNow()}
        style={{
          minHeight: "2rem",
          padding: "0.35rem 0.85rem",
          fontSize: "0.78rem",
        }}
      >
        {previewWorkflowLabel(workflow.previewing)}
      </button>
    </div>
  );
}

function WorkflowSettingsFields({
  workflow,
}: Readonly<{ workflow: ProjectDetailTabsViewModel["workflow"] }>) {
  if (!workflow.settings) {
    return (
      <p className="env-empty-state">Loading workflow settings...</p>
    );
  }

  const settings = workflow.settings;
  return (
    <div className="project-detail-grid">
      <label>
        <dt>Node version</dt>
        <select aria-label="Node version" value={settings.nodeVersion} disabled>
          <option value={settings.nodeVersion}>{settings.nodeVersion}</option>
        </select>
      </label>
      <CoverageThresholdField
        settings={settings}
        onChange={(coverageThreshold) =>
          workflow.setSettings({ ...settings, coverageThreshold })
        }
      />
      <label>
        <dt>
          Service path
          <HelpTip text="The folder inside the repository where this service's code lives. Used to scope which files trigger this workflow and where build commands run." />
        </dt>
        <input
          aria-label="Service path"
          value={settings.servicePath}
          onChange={(event) =>
            workflow.setSettings({
              ...settings,
              servicePath: event.target.value,
            })
          }
        />
      </label>
      <CentralWorkflowRefField
        settings={settings}
        tags={workflow.tags}
        tagsError={workflow.tagsError}
        onChange={(centralWorkflowRef) =>
          workflow.setSettings({ ...settings, centralWorkflowRef })
        }
      />
    </div>
  );
}

function CoverageThresholdField({
  settings,
  onChange,
}: Readonly<{
  settings: WorkflowSettings;
  onChange: (value: number) => void;
}>) {
  return (
    <label>
      <dt>
        Coverage threshold
        <HelpTip text="The minimum percentage of code that unit tests must exercise. Pipeline runs fail the Quality stage if coverage drops below this number." />
      </dt>
      <select
        aria-label="Coverage threshold"
        value={String(settings.coverageThreshold)}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        <CurrentCoverageOption threshold={settings.coverageThreshold} />
        {COVERAGE_THRESHOLD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CurrentCoverageOption({
  threshold,
}: Readonly<{ threshold: number }>) {
  if (coverageHasPreset(threshold)) return null;
  return (
    <option value={String(threshold)}>{threshold}% (current)</option>
  );
}

function CentralWorkflowRefField({
  settings,
  tags,
  tagsError,
  onChange,
}: Readonly<{
  settings: WorkflowSettings;
  tags: string[] | null;
  tagsError: string | null;
  onChange: (value: string) => void;
}>) {
  return (
    <label>
      <dt>
        Central workflow ref
        <HelpTip text="The tag of Alpha-Explora/alphaci-workflow that this project's pipeline is pinned to. It supplies the reusable gated-stage logic — Access, Quality, Package — that every generated workflow calls into. Options are the real tags published on that repo." />
      </dt>
      <select
        aria-label="Central workflow ref"
        value={settings.centralWorkflowRef}
        disabled={!tags}
        onChange={(event) => onChange(event.target.value)}
      >
        <CentralWorkflowRefOptions
          current={settings.centralWorkflowRef}
          tags={tags}
          tagsError={tagsError}
        />
      </select>
      <WorkflowError message={tagsError} compact />
    </label>
  );
}

function CentralWorkflowRefOptions({
  current,
  tags,
  tagsError,
}: Readonly<{
  current: string;
  tags: string[] | null;
  tagsError: string | null;
}>) {
  if (!tags) {
    return (
      <option value={current}>
        {tagsError ? current : "Loading tags..."}
      </option>
    );
  }
  return (
    <>
      <CurrentCentralRefOption current={current} tags={tags} />
      {tags.map((tag) => (
        <option key={tag} value={tag}>
          {tag}
        </option>
      ))}
    </>
  );
}

function CurrentCentralRefOption({
  current,
  tags,
}: Readonly<{ current: string; tags: string[] }>) {
  if (centralRefIsListed(tags, current)) return null;
  return (
    <option value={current}>{current} (current)</option>
  );
}

function WorkflowChecksField({
  workflow,
}: Readonly<{ workflow: ProjectDetailTabsViewModel["workflow"] }>) {
  if (!workflow.settings) return null;
  const settings = workflow.settings;
  return (
    <div>
      <span
        className="input-label"
        style={{
          display: "block",
          marginBottom: "0.5rem",
        }}
      >
        Workflow checks
      </span>
      <div
        className="enhancement-chips"
        aria-label="Workflow checks"
        role="group"
        style={{ gap: "0.5rem", flexWrap: "wrap" }}
      >
        {WORKFLOW_CHECK_OPTIONS.map((check) => (
          <WorkflowCheckChip
            key={check.key}
            check={check}
            checked={settings.checks[check.key]}
            onChange={(value) =>
              workflow.setSettings({
                ...settings,
                checks: { ...settings.checks, [check.key]: value },
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

function WorkflowCheckChip({
  check,
  checked,
  onChange,
}: Readonly<{
  check: (typeof WORKFLOW_CHECK_OPTIONS)[number];
  checked: boolean;
  onChange: (value: boolean) => void;
}>) {
  return (
    <motion.label
      className={`enhancement-chip-label-premium${checked ? " enhancement-chip-label--active" : ""}`}
      htmlFor={`workflow-check-${check.key}`}
      whileTap={{ scale: 0.95 }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 20,
      }}
    >
      <input
        id={`workflow-check-${check.key}`}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="enhancement-chip-dot" aria-hidden="true" />
      {check.label}
    </motion.label>
  );
}

function WorkflowDeployMappings({
  targets,
}: Readonly<{ targets: DeploymentTarget[] }>) {
  return (
    <div>
      <h4
        style={{
          margin: "0 0 0.5rem",
          fontSize: "0.85rem",
        }}
      >
        Deploy target mappings
      </h4>
      <WorkflowDeployMappingsBody targets={targets} />
    </div>
  );
}

function WorkflowDeployMappingsBody({
  targets,
}: Readonly<{ targets: DeploymentTarget[] }>) {
  if (!targets.length) {
    return (
      <p className="env-empty-state">No deployment target mappings.</p>
    );
  }
  return (
    <div className="env-metadata-list">
      {targets.map((target) => (
        <div key={target.id} className="env-metadata-row provisioned">
          <span>{target.slot}</span>
          <span>
            {target.providerProjectName} / {target.branchName}
          </span>
        </div>
      ))}
    </div>
  );
}

function WorkflowError({
  message,
  compact,
}: Readonly<{ message: string | null; compact?: boolean }>) {
  if (!message) return null;
  if (compact) {
    return (
      <p
        className="error-text"
        style={{
          margin: "0.3rem 0 0",
          fontSize: "0.72rem",
        }}
      >
        {message}
      </p>
    );
  }
  return (
    <p className="error-text" style={{ margin: 0 }}>
      {message}
    </p>
  );
}

function WorkflowPreviewWarnings({
  preview,
}: Readonly<{ preview: WorkflowSettingsPreviewResponse | null }>) {
  if (!preview?.validationWarnings.length) return null;
  return (
    <div className="env-metadata-list">
      {preview.validationWarnings.map((warning) => (
        <div
          key={`${warning.field}-${warning.message}`}
          className="env-metadata-row failed"
        >
          <span>{warning.field}</span>
          <span>{warning.message}</span>
        </div>
      ))}
    </div>
  );
}

function WorkflowPreviewResult({
  preview,
  workflow,
  workflowUpdatePrEnabled,
  canCreateUpdatePr,
}: Readonly<{
  preview: WorkflowSettingsPreviewResponse | null;
  workflow: ProjectDetailTabsViewModel["workflow"];
  workflowUpdatePrEnabled: boolean;
  canCreateUpdatePr: boolean;
}>) {
  if (!preview) return null;
  return (
    <>
      <div className="env-metadata-list">
        {preview.diffSummary.map((item) => (
          <div key={item.path} className="env-metadata-row provisioned">
            <span>{item.path}</span>
            <span className={previewDiffBadgeClass(item.status)}>
              {item.status}
            </span>
          </div>
        ))}
      </div>
      <CreateUpdatePrRow
        workflow={workflow}
        enabled={workflowUpdatePrEnabled}
        canCreate={canCreateUpdatePr}
      />
      <WorkflowError message={workflow.updatePrError} />
    </>
  );
}

function CreateUpdatePrRow({
  workflow,
  enabled,
  canCreate,
}: Readonly<{
  workflow: ProjectDetailTabsViewModel["workflow"];
  enabled: boolean;
  canCreate: boolean;
}>) {
  if (!enabled) return null;
  if (!canCreate) {
    return <p className="env-empty-state">{UPDATE_PR_ROLE_NOTE}</p>;
  }
  return (
    <div
      style={{
        display: "flex",
        gap: "0.75rem",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <button
        className="primary-button"
        type="button"
        disabled={workflow.creatingPr}
        onClick={() => void workflow.createPr()}
        style={{
          minHeight: "2rem",
          padding: "0.35rem 0.85rem",
          fontSize: "0.78rem",
        }}
      >
        {createUpdatePrLabel(workflow.creatingPr)}
      </button>
      <span style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>
        {UPDATE_PR_TARGET_NOTE}
      </span>
      <WorkflowPrLink url={workflow.updatePr?.pullRequestUrl ?? null} />
    </div>
  );
}

function WorkflowPrLink({ url }: Readonly<{ url: string | null }>) {
  if (!url) return null;
  return (
    <a
      className="ghost-button"
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        minHeight: "2rem",
        padding: "0.35rem 0.85rem",
        fontSize: "0.78rem",
      }}
    >
      {url}
    </a>
  );
}
