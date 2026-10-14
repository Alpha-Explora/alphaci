"use client";

import { useEffect, useRef } from "react";

import type { EnvVarMetadata } from "@/shared/api/contracts";
import { cleanUserMessage } from "@/features/workflows";
import {
  missingKeysHeadline,
  missingLaneKeys,
  variableSetLabel,
  variablesInScope,
  variablesScopeLabel,
  variablesScopeLine,
  type HostingEnvironment,
} from "../model/hosting-environment-rules";
import type {
  EnvVariablesEditor,
  EnvVariablesScope,
  ProjectEnvProvisioning,
} from "../view-models/use-env-variables-editor-view-model";
import { EnvVariablesForm } from "./env-variables-form";
import { HostingMenu } from "./hosting-menu";

/** The writable side: the provisioning read and the editor over it. Null renders read-only. */
export interface ManagedVariables {
  env: ProjectEnvProvisioning;
  editor: EnvVariablesEditor;
}

/**
 * The selected environment's variables on the selected service: one lane
 * (production, or one preview branch), its keys and who set them, Add and
 * Bulk edit scoped to it, and for a preview lane the keys Production has that
 * it lacks. Values are never shown; they are write-only.
 */
export function HostingVariablesCard({
  scope,
  environment,
  onPreviewBranchChange,
  metadata,
  managed,
  providerName,
  focus,
}: Readonly<{
  scope: EnvVariablesScope;
  environment: HostingEnvironment;
  onPreviewBranchChange: (branch: string) => void;
  metadata: ReadonlyArray<EnvVarMetadata>;
  managed: ManagedVariables | null;
  providerName: string;
  /** An old #environment link: bring this card into view and focus its heading. */
  focus: boolean;
}>) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const rows = variablesInScope(metadata, scope.targetId, scope.lane, scope.branch);
  const missing = missingLaneKeys(metadata, scope.targetId, scope.lane, scope.branch);

  useEffect(() => {
    if (!focus) return;
    headingRef.current?.scrollIntoView?.({ block: "start" });
    headingRef.current?.focus();
  }, [focus]);

  return (
    <section className="hosting-card hosting-vars" aria-labelledby="hosting-vars-heading">
      <div className="hosting-card__head">
        <div>
          <h4 className="hosting-card__title" id="hosting-vars-heading" ref={headingRef} tabIndex={-1}>
            Variables
          </h4>
          <p className="hosting-quiet hosting-vars__scope">{variablesScopeLine(scope.lane, scope.branch, rows.length)}</p>
        </div>
        <VariableActions managed={managed} scope={scope} />
      </div>
      <PreviewBranchSelect environment={environment} value={scope.branch} onChange={onPreviewBranchChange} />
      <LaneCheck missing={missing} managed={managed} scope={scope} />
      <VariablesForm managed={managed} />
      <EditorMessage managed={managed} />
      <VariableRows rows={rows} managed={managed} />
      <p className="hosting-quiet hosting-vars__footer">
        Values are write-only: ALPHACI sends them to {providerName} and never shows them again.
      </p>
    </section>
  );
}

function VariableActions({ managed, scope }: Readonly<{ managed: ManagedVariables | null; scope: EnvVariablesScope }>) {
  if (!managed) return null;
  return (
    <div className="hosting-card__actions">
      <button
        type="button"
        className="hosting-btn hosting-btn--primary"
        onClick={() => managed.editor.openScoped(scope)}
      >
        Add
      </button>
      <button
        type="button"
        className="hosting-btn"
        onClick={() => managed.editor.openScoped(scope, { bulk: true })}
      >
        Bulk edit
      </button>
    </div>
  );
}

/** Previews: which preview branch's variables the card shows. */
function PreviewBranchSelect({
  environment,
  value,
  onChange,
}: Readonly<{ environment: HostingEnvironment; value: string | null; onChange: (branch: string) => void }>) {
  if (environment.kind !== "previews" || !environment.previewBranches.length) return null;
  return (
    <label className="hosting-field">
      <span>Preview branch</span>
      <select aria-label="Preview branch" value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        {environment.previewBranches.map((branch) => (
          <option key={branch} value={branch}>
            {branch}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Keys set in Production that this preview lane lacks, with a way to add them (values empty). */
function LaneCheck({
  missing,
  managed,
  scope,
}: Readonly<{ missing: string[]; managed: ManagedVariables | null; scope: EnvVariablesScope }>) {
  if (!missing.length) return null;
  return (
    <div className="hosting-notice hosting-notice--block" role="status">
      <p className="hosting-notice__title">{missingKeysHeadline(missing.length)}</p>
      <ul className="hosting-notice__keys">
        {missing.map((key) => (
          <li key={key}>
            <code className="hosting-mono">{key}</code>
          </li>
        ))}
      </ul>
      {managed ? (
        <button
          type="button"
          className="hosting-btn hosting-btn--primary"
          onClick={() => managed.editor.openScoped(scope, { keys: missing })}
        >
          Add the missing variables
        </button>
      ) : null}
    </div>
  );
}

function VariablesForm({ managed }: Readonly<{ managed: ManagedVariables | null }>) {
  if (!managed?.editor.isAddingVariable) return null;
  const { editor, env } = managed;
  return (
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
      loading={env.loading}
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
      saving={env.saving}
      scopeLabel={variablesScopeLabel(editor.lane, editor.previewBranch || null)}
      setIsBulkEnvDialogOpen={editor.setIsBulkEnvDialogOpen}
      targets={env.targets}
    />
  );
}

function EditorMessage({ managed }: Readonly<{ managed: ManagedVariables | null }>) {
  const message = managed?.editor.message;
  if (!message) return null;
  return (
    <p className="hosting-quiet" role="status">
      {message}
    </p>
  );
}

function VariableRows({
  rows,
  managed,
}: Readonly<{ rows: ReadonlyArray<EnvVarMetadata>; managed: ManagedVariables | null }>) {
  if (!rows.length) return <p className="hosting-quiet">No variables in this environment yet.</p>;
  return (
    <ul className="hosting-rows" aria-label="Variables">
      {rows.map((item) => (
        <li className="hosting-row" key={item.id}>
          <code className="hosting-mono hosting-row__main">{item.key}</code>
          <VariableState item={item} />
          <RowActions item={item} managed={managed} />
        </li>
      ))}
    </ul>
  );
}

function VariableState({ item }: Readonly<{ item: EnvVarMetadata }>) {
  if (item.status === "failed") {
    return (
      <span className="hosting-row__failed">
        {item.errorSummary ? cleanUserMessage(item.errorSummary) : "Failed to provision"}
      </span>
    );
  }
  return <span className="hosting-row__time">{variableSetLabel(item)}</span>;
}

/** Re-enter a value or remove the key, as the variables list always offered; removing asks first. */
function RowActions({ item, managed }: Readonly<{ item: EnvVarMetadata; managed: ManagedVariables | null }>) {
  if (!managed) return null;
  const { editor } = managed;
  if (editor.confirmDeleteId === item.id) {
    return (
      <span className="hosting-row__confirm">
        <button type="button" className="hosting-btn" onClick={editor.cancelDelete}>
          Cancel
        </button>
        <button
          type="button"
          className="hosting-btn hosting-btn--danger"
          onClick={() => void editor.deleteMetadata(item)}
        >
          Confirm remove
        </button>
      </span>
    );
  }
  return (
    <HostingMenu
      label={`Actions for ${item.key}`}
      items={[
        { label: "Re-enter value", onSelect: () => editor.startReProvision(item) },
        { label: "Remove", destructive: true, onSelect: () => void editor.deleteMetadata(item) },
      ]}
    />
  );
}
