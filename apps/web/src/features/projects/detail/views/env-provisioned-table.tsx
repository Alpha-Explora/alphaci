"use client";

import type { DeploymentTarget, EnvVarMetadata } from "@/features/projects";
import { cleanUserMessage } from "@/features/workflows";
import {
  scopeLabel,
  targetOptionLabel,
} from "../model/env-panel-rules";

export function EnvProvisionedTable({
  confirmDeleteId,
  filterEnvironment,
  filterStatus,
  filterTargetId,
  filteredMetadata,
  metadata,
  onDelete,
  onFilterEnvironmentChange,
  onFilterStatusChange,
  onFilterTargetChange,
  onReProvision,
  onStartAdd,
  presentScopes,
  targets,
}: Readonly<{
  confirmDeleteId: string | null;
  filterEnvironment: string;
  filterStatus: "all" | EnvVarMetadata["status"];
  filterTargetId: string;
  filteredMetadata: EnvVarMetadata[];
  metadata: EnvVarMetadata[];
  onDelete: (item: EnvVarMetadata) => void;
  onFilterEnvironmentChange: (value: string) => void;
  onFilterStatusChange: (value: "all" | EnvVarMetadata["status"]) => void;
  onFilterTargetChange: (value: string) => void;
  onReProvision: (item: EnvVarMetadata) => void;
  onStartAdd: () => void;
  presentScopes: Array<{ value: string; label: string }>;
  targets: DeploymentTarget[];
}>) {
  return (
    <section className="env-provisioning-section env-provisioned-variables">
      <div className="env-section-header">
        <h4>Provisioned variables</h4>
        <div className="env-provisioned-variables__actions">
          <button className="ghost-button" type="button" onClick={onStartAdd}>
            Add variable
          </button>
        </div>
      </div>
      {metadata.length ? (
        <EnvMetadataFilters
          filterEnvironment={filterEnvironment}
          filterStatus={filterStatus}
          filterTargetId={filterTargetId}
          onFilterEnvironmentChange={onFilterEnvironmentChange}
          onFilterStatusChange={onFilterStatusChange}
          onFilterTargetChange={onFilterTargetChange}
          presentScopes={presentScopes}
          targets={targets}
        />
      ) : null}
      {filteredMetadata.length ? (
        <div className="env-metadata-list">
          {filteredMetadata.map((item) => (
            <EnvMetadataRow
              confirmDeleteId={confirmDeleteId}
              item={item}
              key={item.id}
              onDelete={onDelete}
              onReProvision={onReProvision}
            />
          ))}
        </div>
      ) : (
        <p className="env-empty-state">No variables provisioned yet.</p>
      )}
    </section>
  );
}

function EnvMetadataFilters({
  filterEnvironment,
  filterStatus,
  filterTargetId,
  onFilterEnvironmentChange,
  onFilterStatusChange,
  onFilterTargetChange,
  presentScopes,
  targets,
}: Readonly<{
  filterEnvironment: string;
  filterStatus: "all" | EnvVarMetadata["status"];
  filterTargetId: string;
  onFilterEnvironmentChange: (value: string) => void;
  onFilterStatusChange: (value: "all" | EnvVarMetadata["status"]) => void;
  onFilterTargetChange: (value: string) => void;
  presentScopes: Array<{ value: string; label: string }>;
  targets: DeploymentTarget[];
}>) {
  return (
    <div className="env-target-grid env-metadata-filters">
      <select
        aria-label="Filter target"
        value={filterTargetId}
        onChange={(event) => onFilterTargetChange(event.target.value)}
      >
        <option value="all">All targets</option>
        {targets.map((target) => (
          <option key={target.id} value={target.id}>
            {targetOptionLabel(target)}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter environment"
        value={filterEnvironment}
        onChange={(event) => onFilterEnvironmentChange(event.target.value)}
      >
        <option value="all">All environments</option>
        {presentScopes.map((scope) => (
          <option key={scope.value} value={scope.value}>
            {scope.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter status"
        value={filterStatus}
        onChange={(event) =>
          onFilterStatusChange(
            event.target.value as "all" | EnvVarMetadata["status"],
          )
        }
      >
        <option value="all">All statuses</option>
        <option value="provisioned">provisioned</option>
        <option value="failed">failed</option>
      </select>
    </div>
  );
}

function EnvMetadataRow({
  confirmDeleteId,
  item,
  onDelete,
  onReProvision,
}: Readonly<{
  confirmDeleteId: string | null;
  item: EnvVarMetadata;
  onDelete: (item: EnvVarMetadata) => void;
  onReProvision: (item: EnvVarMetadata) => void;
}>) {
  return (
    <div className={`env-metadata-row ${item.status}`}>
      <span>{item.key}</span>
      <span>
        {scopeLabel(item)} - {item.status}
        {item.errorSummary ? ` - ${cleanUserMessage(item.errorSummary)}` : ""}
      </span>
      <span className="env-metadata-actions">
        <button
          className="ghost-button"
          type="button"
          onClick={() => onReProvision(item)}
        >
          Re-provision
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={() => onDelete(item)}
        >
          {confirmDeleteId === item.id ? "Confirm delete" : "Delete"}
        </button>
      </span>
    </div>
  );
}
