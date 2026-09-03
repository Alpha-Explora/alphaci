"use client";

import type { ValidateEnvVarsResponse } from "@/features/projects";
import { bulkValidationSummary } from "../model/env-panel-rules";

export function EnvBulkDialog({
  activeTargetId,
  bulkEnvText,
  bulkValidation,
  loading,
  onClose,
  onTextChange,
  onUseParsedKeys,
  onValidate,
  saving,
}: Readonly<{
  activeTargetId: string;
  bulkEnvText: string;
  bulkValidation: ValidateEnvVarsResponse | null;
  loading: boolean;
  onClose: () => void;
  onTextChange: (value: string) => void;
  onUseParsedKeys: () => void;
  onValidate: () => void;
  saving: boolean;
}>) {
  const validateDisabled =
    saving || loading || !activeTargetId || bulkEnvText.trim() === "";

  return (
    <section
      className="env-bulk-editor env-bulk-editor--dialog"
      aria-label="Paste a .env file"
      aria-modal="true"
      role="dialog"
    >
      <div className="env-variable-subheader">
        <div>
          <strong>Paste a .env file</strong>
          <span>Validate keys before adding them to the form.</span>
        </div>
      </div>
      <textarea
        aria-label="Bulk env text"
        value={bulkEnvText}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder={"DATABASE_URL=...\nAPI_KEY=..."}
        rows={6}
      />
      <button
        className="ghost-button env-bulk-editor__validate"
        disabled={validateDisabled}
        type="button"
        onClick={onValidate}
      >
        Validate .env
      </button>

      <button className="ghost-button" type="button" onClick={onClose}>
        Close
      </button>

      {bulkValidation ? (
        <div className="env-bulk-validation">
          <span>
            <strong>Parsed keys</strong>
            <br />
            {bulkValidationSummary(bulkValidation)}
          </span>
          <button
            className="ghost-button"
            disabled={!bulkValidation.keys.length}
            type="button"
            onClick={onUseParsedKeys}
          >
            Use parsed keys
          </button>
        </div>
      ) : null}
    </section>
  );
}
