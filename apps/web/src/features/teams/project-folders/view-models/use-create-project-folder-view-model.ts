"use client";

import { useState } from "react";

import { projectFoldersRepository } from "../data/project-folders-repository";
import { createErrorMessage, projectNameError } from "../model/project-folder-rules";

export type CreateProjectFolderStatus = "idle" | "saving" | "error";

export interface CreateProjectFolderViewModel {
  status: CreateProjectFolderStatus;
  error: string | null;
  open: boolean;
  name: string;
  description: string;
  canSubmit: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  submit: () => Promise<void>;
}

/** ViewModel for the New Project dialog: an empty Project in this team. */
export function useCreateProjectFolderViewModel(options: {
  groupId: string;
  onCreated: (name: string) => void;
  /** A deep link asked for the dialog (read once, on mount). */
  openOnArrival?: boolean;
  /**
   * Whether the caller may create a Project. The session can still be loading
   * on arrival, so the asked-for dialog opens the moment this turns true.
   */
  canCreate?: boolean;
}): CreateProjectFolderViewModel {
  const { groupId, onCreated, openOnArrival = false, canCreate = true } = options;
  const [open, setOpen] = useState(false);
  const [arrivalPending, setArrivalPending] = useState(openOnArrival);
  // Applied while rendering (state derived from a changing input), once.
  if (arrivalPending && canCreate) {
    setArrivalPending(false);
    setOpen(true);
  }
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<CreateProjectFolderStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (status === "saving") return;
    const invalid = projectNameError(name);
    if (invalid) {
      setStatus("error");
      setError(invalid);
      return;
    }
    setStatus("saving");
    setError(null);
    const trimmed = name.trim();
    const trimmedDescription = description.trim();
    try {
      await projectFoldersRepository.create(groupId, {
        name: trimmed,
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
      });
      setStatus("idle");
      setOpen(false);
      onCreated(trimmed);
    } catch (cause) {
      setStatus("error");
      setError(createErrorMessage(cause));
    }
  }

  return {
    status,
    error,
    open,
    name,
    description,
    canSubmit: projectNameError(name) === null,
    openDialog: () => {
      setName("");
      setDescription("");
      setError(null);
      setStatus("idle");
      setOpen(true);
    },
    closeDialog: () => {
      if (status !== "saving") setOpen(false);
    },
    setName,
    setDescription,
    submit,
  };
}
