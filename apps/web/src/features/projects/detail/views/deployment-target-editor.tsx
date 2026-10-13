"use client";

import type {
  DeploymentTarget,
  EnvEnvironment,
  UpdateDeploymentTargetRequest,
} from "@/features/projects";
import {
  hostingProviderLabel,
  saveMetadataLabel,
} from "../model/project-detail-tab-rules";

/**
 * The service's build settings, edited inline under the Hosting tab's service
 * header ("Edit build settings"). Metadata only: provider resources and
 * secrets are unchanged.
 */
export function DeploymentTargetEditor({
  editingTarget,
  editValues,
  savingTargetId,
  onCancel,
  onChange,
  onSave,
}: Readonly<{
  editingTarget: DeploymentTarget | null;
  editValues: UpdateDeploymentTargetRequest;
  savingTargetId: string | null;
  onCancel: () => void;
  onChange: (values: UpdateDeploymentTargetRequest) => void;
  onSave: () => void;
}>) {
  if (!editingTarget) return null;

  return (
    <div
      className="env-card deployment-target-editor"
      data-testid="target-edit-drawer"
      style={{ gap: "0.85rem" }}
    >
      <div>
        <h4 style={{ margin: 0 }}>Edit deployment target</h4>
        <p className="env-empty-state" style={{ margin: "0.25rem 0 0" }}>
          Metadata edits only. Provider resources and secrets are unchanged.
        </p>
      </div>
      <div className="deployment-target-editor__grid">
        <label className="deployment-target-editor__field deployment-target-editor__field--name">
          <span>Display name</span>
          <input
            aria-label="Target display name"
            value={editValues.providerProjectName ?? ""}
            onChange={(event) =>
              onChange({
                ...editValues,
                providerProjectName: event.target.value,
              })
            }
          />
        </label>
        <div className="deployment-target-editor__field deployment-target-editor__field--hosting">
          <span>Hosting</span>
          <strong>{hostingProviderLabel(editingTarget.provider)}</strong>
        </div>
        <label className="deployment-target-editor__field deployment-target-editor__field--branch">
          <span>Branch</span>
          <input
            aria-label="Target branch"
            value={editValues.branchName ?? ""}
            onChange={(event) =>
              onChange({ ...editValues, branchName: event.target.value })
            }
          />
        </label>
        <label className="deployment-target-editor__field deployment-target-editor__field--root">
          <span>Root directory</span>
          <input
            aria-label="Target root directory"
            value={editValues.rootDirectory ?? ""}
            onChange={(event) =>
              onChange({ ...editValues, rootDirectory: event.target.value })
            }
          />
        </label>
        <label className="deployment-target-editor__field deployment-target-editor__field--build">
          <span>Build command</span>
          <input
            aria-label="Target build command"
            value={editValues.buildCommand ?? ""}
            onChange={(event) =>
              onChange({ ...editValues, buildCommand: event.target.value })
            }
          />
        </label>
        <label className="deployment-target-editor__field deployment-target-editor__field--start">
          <span>Start command</span>
          <input
            aria-label="Target start command"
            value={editValues.startCommand ?? ""}
            onChange={(event) =>
              onChange({ ...editValues, startCommand: event.target.value })
            }
          />
        </label>
        <RenderEnvironmentField
          provider={editingTarget.provider}
          value={editValues.renderEnvironmentName ?? ""}
          onChange={(value) =>
            onChange({
              ...editValues,
              renderEnvironmentName: value,
            })
          }
        />
      </div>
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <button className="ghost-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={savingTargetId === editingTarget.id}
          onClick={onSave}
        >
          {saveMetadataLabel(savingTargetId === editingTarget.id)}
        </button>
      </div>
    </div>
  );
}

function RenderEnvironmentField({
  provider,
  value,
  onChange,
}: Readonly<{
  provider: DeploymentTarget["provider"];
  value: string;
  onChange: (value: EnvEnvironment | null) => void;
}>) {
  if (provider !== "render") return null;
  return (
    <label className="deployment-target-editor__field deployment-target-editor__field--environment">
      <span>Provider environment</span>
      <select
        aria-label="Target provider environment"
        value={value}
        onChange={(event) =>
          onChange((event.target.value || null) as EnvEnvironment | null)
        }
      >
        <option value="">Not configured</option>
        <option value="test">Test</option>
        <option value="uat">UAT</option>
        <option value="production">Production</option>
      </select>
    </label>
  );
}
