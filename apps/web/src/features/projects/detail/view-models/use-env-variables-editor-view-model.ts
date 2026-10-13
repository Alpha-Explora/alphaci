"use client";

import { useMemo, useState, type FormEvent } from "react";

import type {
  DeploymentTarget,
  EnvLane,
  EnvVarMetadata,
  EnvVarScope,
  UsageLimitItem,
  ValidateEnvVarsResponse,
} from "@/shared/api/contracts";
import { formatApiError } from "@/features/workflows";
import {
  envRowsInvalid,
  isEnvKeyQuotaReached,
  knownTargetBranches,
  resolveActiveTargetId,
  resolvePreviewScope,
  type EnvRow,
} from "../model/env-panel-rules";
import type { useProjectEnvProvisioning } from "./use-project-env-provisioning-view-model";

export type ProjectEnvProvisioning = ReturnType<typeof useProjectEnvProvisioning>;

/** One environment's variables: a target, and its production lane or one preview branch. */
export interface EnvVariablesScope {
  targetId: string;
  lane: EnvLane;
  /** The preview branch; null for the production lane. */
  branch: string | null;
}

export interface EnvVariablesEditor {
  targetId: string;
  setTargetId: (value: string) => void;
  lane: EnvLane;
  setLane: (value: EnvLane) => void;
  previewBranch: string;
  setPreviewBranch: (value: string) => void;
  rows: EnvRow[];
  setRows: (rows: EnvRow[]) => void;
  /** The last outcome, as a display string. */
  message: string | null;
  setMessage: (message: string | null) => void;
  bulkEnvText: string;
  setBulkEnvText: (value: string) => void;
  bulkValidation: ValidateEnvVarsResponse | null;
  isAddingVariable: boolean;
  setIsAddingVariable: (open: boolean) => void;
  isBulkEnvDialogOpen: boolean;
  setIsBulkEnvDialogOpen: (open: boolean) => void;
  confirmDeleteId: string | null;
  activeTargetId: string;
  activeTarget: DeploymentTarget | undefined;
  activeScope: EnvVarScope;
  knownBranches: string[];
  envKeyQuota: UsageLimitItem | null;
  envKeyQuotaReached: boolean;
  invalid: boolean;
  provision: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  bulkValidate: () => Promise<void>;
  applyParsedKeys: () => void;
  deleteMetadata: (item: EnvVarMetadata) => Promise<void>;
  cancelDelete: () => void;
  startReProvision: (item: EnvVarMetadata) => void;
  /**
   * Open the add form on one environment's scope: empty, prefilled with keys
   * (values left empty), or with the paste-a-.env dialog open.
   */
  openScoped: (scope: EnvVariablesScope, options?: { keys?: string[]; bulk?: boolean }) => void;
}

const EMPTY_ROWS: EnvRow[] = [{ key: "", value: "" }];

function rowsForKeys(keys: string[] | undefined): EnvRow[] {
  return keys?.length ? keys.map((key) => ({ key, value: "" })) : EMPTY_ROWS;
}

/**
 * The environment-variable form's state and handlers: add, paste a .env file,
 * re-provision, and delete with a confirmation step. Shared by the env panel
 * and the Hosting tab's Variables card, so both write variables the same way.
 * Values never outlive a submit: rows are cleared after provisioning and the
 * pasted text after validation.
 */
export function useEnvVariablesEditor(env: ProjectEnvProvisioning): EnvVariablesEditor {
  const { removeMetadata, provision: provisionVars, targets, usageItems, validateEnvText } = env;
  const [targetId, setTargetId] = useState("");
  const [lane, setLane] = useState<EnvLane>("preview");
  const [previewBranch, setPreviewBranch] = useState("");
  const [rows, setRows] = useState<EnvRow[]>(EMPTY_ROWS);
  const [message, setMessage] = useState<string | null>(null);
  const [bulkEnvText, setBulkEnvText] = useState("");
  const [isAddingVariable, setIsAddingVariable] = useState(false);
  const [isBulkEnvDialogOpen, setIsBulkEnvDialogOpen] = useState(false);
  const [bulkValidation, setBulkValidation] = useState<ValidateEnvVarsResponse | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeTargetId = resolveActiveTargetId(targetId, targets);
  const activeTarget = targets.find((target) => target.id === activeTargetId);
  const knownBranches = useMemo(() => knownTargetBranches(targets), [targets]);
  const activeScope = useMemo(
    () => resolvePreviewScope(lane, previewBranch, activeTarget?.branchName),
    [activeTarget?.branchName, lane, previewBranch],
  );
  const envKeyQuota = useMemo(() => usageItems.find((item) => item.code === "env_keys") ?? null, [usageItems]);
  const invalid = useMemo(() => envRowsInvalid(rows), [rows]);

  async function provision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    try {
      await provisionVars({ deploymentTargetId: activeTargetId, ...activeScope, vars: rows });
      setRows(EMPTY_ROWS);
      setIsAddingVariable(false);
      setMessage("Environment variables provisioned.");
    } catch (error) {
      setMessage(formatApiError(error, "Environment variable provisioning failed"));
    }
  }

  async function bulkValidate() {
    if (!activeTargetId) return;
    setMessage(null);
    try {
      const result = await validateEnvText({ deploymentTargetId: activeTargetId, ...activeScope, text: bulkEnvText });
      setBulkValidation(result);
      setBulkEnvText("");
      setMessage(`Parsed ${result.keyCount} env ${result.keyCount === 1 ? "line" : "lines"}. Values were cleared.`);
    } catch (error) {
      setMessage(formatApiError(error, "Environment variable validation failed"));
    }
  }

  function applyParsedKeys() {
    if (!bulkValidation?.keys.length) return;
    setRows(rowsForKeys(bulkValidation.keys));
    setIsAddingVariable(true);
    setIsBulkEnvDialogOpen(false);
  }

  async function deleteMetadata(item: EnvVarMetadata) {
    if (confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      setMessage("Confirm delete to remove this key from the provider and ALPHACI metadata.");
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

  function cancelDelete() {
    setConfirmDeleteId(null);
    setMessage(null);
  }

  function startReProvision(item: EnvVarMetadata) {
    setTargetId(item.deploymentTargetId);
    setLane(item.lane);
    setPreviewBranch(item.gitBranch ?? "");
    setRows([{ key: item.key, value: "" }]);
    setIsAddingVariable(true);
    setMessage(`Re-enter the value for ${item.key} before provisioning.`);
  }

  function openScoped(scope: EnvVariablesScope, options: { keys?: string[]; bulk?: boolean } = {}) {
    setTargetId(scope.targetId);
    setLane(scope.lane);
    setPreviewBranch(scope.branch ?? "");
    setRows(rowsForKeys(options.keys));
    setIsAddingVariable(true);
    setIsBulkEnvDialogOpen(Boolean(options.bulk));
    setMessage(null);
  }

  return {
    targetId,
    setTargetId,
    lane,
    setLane,
    previewBranch,
    setPreviewBranch,
    rows,
    setRows,
    message,
    setMessage,
    bulkEnvText,
    setBulkEnvText,
    bulkValidation,
    isAddingVariable,
    setIsAddingVariable,
    isBulkEnvDialogOpen,
    setIsBulkEnvDialogOpen,
    confirmDeleteId,
    activeTargetId,
    activeTarget,
    activeScope,
    knownBranches,
    envKeyQuota,
    envKeyQuotaReached: isEnvKeyQuotaReached(envKeyQuota),
    invalid,
    provision,
    bulkValidate,
    applyParsedKeys,
    deleteMetadata,
    cancelDelete,
    startReProvision,
    openScoped,
  };
}
