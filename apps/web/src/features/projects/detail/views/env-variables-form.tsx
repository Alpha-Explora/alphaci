"use client";

import type { FormEvent } from "react";

import type {
  DeploymentTarget,
  EnvLane,
  UsageLimitItem,
  ValidateEnvVarsResponse,
} from "@/features/projects";
import { formatQuotaStatus } from "@/features/workflows";
import {
  activeBranch,
  targetOptionLabel,
  type EnvRow,
} from "../model/env-panel-rules";
import { EnvBulkDialog } from "./env-bulk-dialog";

export function EnvVariablesForm({
  activeTarget,
  activeTargetId,
  bulkEnvText,
  bulkValidation,
  envKeyQuota,
  envKeyQuotaReached,
  invalid,
  isBulkEnvDialogOpen,
  knownBranches,
  lane,
  loading,
  onBulkTextChange,
  onBulkValidate,
  onCancel,
  onLaneChange,
  onOpenBulkDialog,
  onPreviewBranchChange,
  onProvision,
  onRowsChange,
  onTargetIdChange,
  onUseParsedKeys,
  previewBranch,
  rows,
  saving,
  setIsBulkEnvDialogOpen,
  targets,
}: Readonly<{
  activeTarget: DeploymentTarget | undefined;
  activeTargetId: string;
  bulkEnvText: string;
  bulkValidation: ValidateEnvVarsResponse | null;
  envKeyQuota: UsageLimitItem | null;
  envKeyQuotaReached: boolean;
  invalid: boolean;
  isBulkEnvDialogOpen: boolean;
  knownBranches: string[];
  lane: EnvLane;
  loading: boolean;
  onBulkTextChange: (value: string) => void;
  onBulkValidate: () => void;
  onCancel: () => void;
  onLaneChange: (value: EnvLane) => void;
  onOpenBulkDialog: () => void;
  onPreviewBranchChange: (value: string) => void;
  onProvision: (event: FormEvent<HTMLFormElement>) => void;
  onRowsChange: (rows: EnvRow[]) => void;
  onTargetIdChange: (value: string) => void;
  onUseParsedKeys: () => void;
  previewBranch: string;
  rows: EnvRow[];
  saving: boolean;
  setIsBulkEnvDialogOpen: (open: boolean) => void;
  targets: DeploymentTarget[];
}>) {
  return (
    <form
      className="env-provisioning-section env-variables-form"
      onSubmit={onProvision}
    >
      <div className="env-section-header">
        <div>
          <h4>Add variables</h4>
          <p className="helper-text" style={{ margin: "0.25rem 0 0" }}>
            Add values to the selected hosting service and environment.
          </p>
        </div>
      </div>

      <EnvBranchTargetPicker
        activeTarget={activeTarget}
        activeTargetId={activeTargetId}
        onTargetIdChange={onTargetIdChange}
        targets={targets}
      />

      <div className="env-variable-workspace">
        <EnvVariableEditor
          envKeyQuota={envKeyQuota}
          knownBranches={knownBranches}
          lane={lane}
          onCancel={onCancel}
          onLaneChange={onLaneChange}
          onOpenBulkDialog={onOpenBulkDialog}
          onPreviewBranchChange={onPreviewBranchChange}
          onRowsChange={onRowsChange}
          previewBranch={previewBranch}
          rows={rows}
          submitDisabled={
            saving || loading || !activeTargetId || invalid || envKeyQuotaReached
          }
        />

        {isBulkEnvDialogOpen ? (
          <EnvBulkDialog
            activeTargetId={activeTargetId}
            bulkEnvText={bulkEnvText}
            bulkValidation={bulkValidation}
            loading={loading}
            onClose={() => setIsBulkEnvDialogOpen(false)}
            onTextChange={onBulkTextChange}
            onUseParsedKeys={onUseParsedKeys}
            onValidate={onBulkValidate}
            saving={saving}
          />
        ) : null}
      </div>
    </form>
  );
}

function EnvBranchTargetPicker({
  activeTarget,
  activeTargetId,
  onTargetIdChange,
  targets,
}: Readonly<{
  activeTarget: DeploymentTarget | undefined;
  activeTargetId: string;
  onTargetIdChange: (value: string) => void;
  targets: DeploymentTarget[];
}>) {
  if (!targets.length) {
    return (
      <p className="env-empty-state">
        Add a hosting service before provisioning branch variables.
      </p>
    );
  }

  return (
    <div className="env-target-grid__field env-target-grid__field--wide">
      <span>Branch target</span>
      <div className="env-segmented-actions" role="group">
        {targets.map((target) => (
          <button
            key={target.id}
            className={
              activeTargetId === target.id ? "primary-button" : "ghost-button"
            }
            type="button"
            onClick={() => onTargetIdChange(target.id)}
          >
            {target.provider === "render" ? "Render" : "Vercel"}{" "}
            {activeBranch(target.branchName)}
          </button>
        ))}
      </div>
      {activeTarget ? (
        <span className="helper-text env-target-grid__note">
          {targetOptionLabel(activeTarget)}
        </span>
      ) : null}
    </div>
  );
}

function EnvVariableEditor({
  envKeyQuota,
  knownBranches,
  lane,
  onCancel,
  onLaneChange,
  onOpenBulkDialog,
  onPreviewBranchChange,
  onRowsChange,
  previewBranch,
  rows,
  submitDisabled,
}: Readonly<{
  envKeyQuota: UsageLimitItem | null;
  knownBranches: string[];
  lane: EnvLane;
  onCancel: () => void;
  onLaneChange: (value: EnvLane) => void;
  onOpenBulkDialog: () => void;
  onPreviewBranchChange: (value: string) => void;
  onRowsChange: (rows: EnvRow[]) => void;
  previewBranch: string;
  rows: EnvRow[];
  submitDisabled: boolean;
}>) {
  return (
    <section className="env-variable-editor" aria-label="Variable editor">
      <div className="env-variable-subheader">
        <div>
          <strong>Variables</strong>
          <span>
            {lane === "production"
              ? "These values apply to the production branch."
              : "These values apply to this branch only."}
          </span>
        </div>
        <div className="env-environment-tabs" aria-label="Deployment lane">
          {(["production", "preview"] as EnvLane[]).map((value) => (
            <button
              key={value}
              className={lane === value ? "primary-button" : "ghost-button"}
              type="button"
              onClick={() => onLaneChange(value)}
            >
              {value === "production" ? "Production" : "Branch"}
            </button>
          ))}
        </div>
      </div>

      {lane === "preview" ? (
        <label className="env-branch-field">
          <span>Branch</span>
          <input
            list="env-known-branches"
            onChange={(event) => onPreviewBranchChange(event.target.value)}
            placeholder="feature/checkout"
            value={previewBranch}
          />
          <datalist id="env-known-branches">
            {knownBranches.map((branch) => (
              <option key={branch} value={branch} />
            ))}
          </datalist>
        </label>
      ) : null}

      <div className="env-variable-column-labels" aria-hidden="true">
        <span>Key</span>
        <span>Secret value</span>
      </div>
      <div className="env-variable-rows">
        {rows.map((row, index) => (
          <EnvVarRow
            index={index}
            key={index}
            onKeyChange={(key) =>
              onRowsChange(
                rows.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, key } : item,
                ),
              )
            }
            onRemove={() =>
              onRowsChange(rows.filter((_, itemIndex) => itemIndex !== index))
            }
            onValueChange={(value) =>
              onRowsChange(
                rows.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, value } : item,
                ),
              )
            }
            row={row}
          />
        ))}
      </div>

      {envKeyQuota ? (
        <div className="env-empty-state" role="status">
          Env key quota: {formatQuotaStatus(envKeyQuota)}
        </div>
      ) : null}

      <div className="env-form-actions">
        <button className="ghost-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="ghost-button" type="button" onClick={onOpenBulkDialog}>
          Paste a .env file
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={() => onRowsChange([...rows, { key: "", value: "" }])}
        >
          Add row
        </button>
        <button className="primary-button" disabled={submitDisabled} type="submit">
          Provision
        </button>
      </div>
    </section>
  );
}

function EnvVarRow({
  index,
  onKeyChange,
  onRemove,
  onValueChange,
  row,
}: Readonly<{
  index: number;
  onKeyChange: (key: string) => void;
  onRemove: () => void;
  onValueChange: (value: string) => void;
  row: EnvRow;
}>) {
  return (
    <div className="env-var-row">
      <input
        aria-label={`Variable key ${index + 1}`}
        value={row.key}
        onChange={(event) => onKeyChange(event.target.value.toUpperCase())}
        placeholder="DATABASE_URL"
      />
      <input
        aria-label={`Variable value ${index + 1}`}
        value={row.value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder="Value"
        type="password"
        autoComplete="off"
      />
      <button
        className="env-var-row__remove"
        aria-label={`Remove variable row ${index + 1}`}
        title="Remove variable"
        type="button"
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}
