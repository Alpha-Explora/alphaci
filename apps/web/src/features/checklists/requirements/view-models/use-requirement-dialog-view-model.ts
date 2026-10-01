"use client";

import { useState } from "react";

import { requirementsRepository } from "../../data/requirements-repository";
import {
  blankRequirementDraft,
  createRequirementPayload,
  requirementDraftError,
  requirementDraftFrom,
  requirementError,
  updateRequirementPayload,
  type RequirementError,
} from "../../model/requirement-rules";
import type { Requirement, RequirementDraft, RequirementKind } from "../../model/requirement-types";

export type RequirementDialogStatus = "closed" | "editing" | "saving" | "confirm-archive" | "archiving";

export type RequirementDialogMode =
  | { kind: "create"; requirementKind: RequirementKind }
  | { kind: "edit"; requirement: Requirement };

export interface RequirementDialogViewModel {
  status: RequirementDialogStatus;
  mode: RequirementDialogMode | null;
  draft: RequirementDraft;
  updateDraft: (patch: Partial<RequirementDraft>) => void;
  /** Why the draft cannot be sent. Shown once Save was tried. */
  validationError: string | null;
  error: RequirementError | null;
  openCreate: (kind: RequirementKind) => void;
  openEdit: (requirement: Requirement) => void;
  /** Ask before archiving: it leaves the Project and the next QA run. */
  openArchive: (requirement: Requirement) => void;
  close: () => void;
  submit: () => Promise<void>;
  confirmArchive: () => Promise<void>;
}

const SAVE_ERROR = "The requirement could not be saved. Try again in a moment.";
const ARCHIVE_ERROR = "The requirement could not be archived. Try again in a moment.";

function kindOf(mode: RequirementDialogMode): RequirementKind {
  return mode.kind === "create" ? mode.requirementKind : mode.requirement.kind;
}

/**
 * ViewModel for the requirement dialog (Product owner, admin): create a
 * Feature or a System requirement — optionally with its first stories, one
 * per line — rename or re-describe one, or archive it. An edit carries the
 * version read, so two Product owners editing at once get a 409 instead of
 * silently overwriting each other.
 */
export function useRequirementDialogViewModel(options: {
  deliveryProjectId: string;
  onSaved: (requirement: Requirement) => void;
}): RequirementDialogViewModel {
  const { deliveryProjectId, onSaved } = options;
  const [mode, setMode] = useState<RequirementDialogMode | null>(null);
  const [archiving, setArchiving] = useState<Requirement | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<RequirementDraft>(blankRequirementDraft);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<RequirementError | null>(null);

  function reset() {
    setAttempted(false);
    setError(null);
  }

  function openCreate(requirementKind: RequirementKind) {
    setArchiving(null);
    setMode({ kind: "create", requirementKind });
    setDraft(blankRequirementDraft());
    reset();
  }

  function openEdit(requirement: Requirement) {
    setArchiving(null);
    setMode({ kind: "edit", requirement });
    setDraft(requirementDraftFrom(requirement));
    reset();
  }

  function openArchive(requirement: Requirement) {
    setMode(null);
    setArchiving(requirement);
    reset();
  }

  function close() {
    if (busy) return;
    setMode(null);
    setArchiving(null);
  }

  async function write(task: () => Promise<Requirement | null>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      const saved = await task();
      if (saved) onSaved(saved);
      setMode(null);
      setArchiving(null);
    } catch (cause) {
      setError(requirementError(cause, fallback));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!mode || busy) return;
    setAttempted(true);
    if (requirementDraftError(draft, kindOf(mode))) return;
    if (mode.kind === "create") {
      const body = createRequirementPayload(mode.requirementKind, draft);
      await write(() => requirementsRepository.create(deliveryProjectId, body), SAVE_ERROR);
      return;
    }
    const target = mode.requirement;
    const body = updateRequirementPayload(target, draft);
    await write(async () => (body ? requirementsRepository.update(target.id, body) : null), SAVE_ERROR);
  }

  async function confirmArchive() {
    if (!archiving || busy) return;
    const target = archiving;
    await write(() => requirementsRepository.archive(target.id), ARCHIVE_ERROR);
  }

  function status(): RequirementDialogStatus {
    if (archiving) return busy ? "archiving" : "confirm-archive";
    if (!mode) return "closed";
    return busy ? "saving" : "editing";
  }

  return {
    status: status(),
    mode: archiving ? { kind: "edit", requirement: archiving } : mode,
    draft,
    updateDraft: (patch) => setDraft((current) => ({ ...current, ...patch })),
    validationError: attempted && mode ? requirementDraftError(draft, kindOf(mode)) : null,
    error,
    openCreate,
    openEdit,
    openArchive,
    close,
    submit,
    confirmArchive,
  };
}
