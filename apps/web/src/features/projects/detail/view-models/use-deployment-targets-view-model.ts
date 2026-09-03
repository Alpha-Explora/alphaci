"use client";

import { useState } from "react";

import { projectsRepository } from "../../data/projects-repository";
import type { ProjectStatus } from "../../model/projects-types";
import type {
  DeploymentTarget,
  UpdateDeploymentTargetRequest,
} from "@/shared/api/contracts";
import {
  emptyToNull,
  targetDetachMessage,
  targetSyncMessage,
} from "../model/project-detail-tab-rules";

export interface DeploymentTargetsViewModel {
  status: ProjectStatus;
  message: string | null;
  savingTargetId: string | null;
  syncingTargetId: string | null;
  detachingTargetId: string | null;
  save: (
    targetId: string,
    values: UpdateDeploymentTargetRequest,
  ) => Promise<DeploymentTarget | null>;
  sync: (target: DeploymentTarget) => Promise<DeploymentTarget | null>;
  detach: (
    target: DeploymentTarget,
    deleteProviderResource: boolean,
  ) => Promise<boolean>;
  setMessage: (message: string | null) => void;
  clearMessage: () => void;
}

export function useDeploymentTargetsViewModel(options: {
  projectId: string;
  onTargetChanged: (target: DeploymentTarget) => void;
  onDetached: (targetId: string) => void;
}): DeploymentTargetsViewModel {
  const { projectId, onTargetChanged, onDetached } = options;
  const [status, setStatus] = useState<ProjectStatus>("ready");
  const [message, setMessage] = useState<string | null>(null);
  const [savingTargetId, setSavingTargetId] = useState<string | null>(null);
  const [syncingTargetId, setSyncingTargetId] = useState<string | null>(null);
  const [detachingTargetId, setDetachingTargetId] = useState<string | null>(
    null,
  );

  async function save(
    targetId: string,
    values: UpdateDeploymentTargetRequest,
  ): Promise<DeploymentTarget | null> {
    setSavingTargetId(targetId);
    setMessage(null);
    setStatus("loading");
    try {
      const updatedTarget = await projectsRepository.updateDeploymentTarget(
        projectId,
        targetId,
        trimmedTargetValues(values),
      );
      onTargetChanged(updatedTarget);
      setMessage("Target metadata updated.");
      setStatus("ready");
      return updatedTarget;
    } catch {
      setMessage("Unable to update target metadata.");
      setStatus("error");
      return null;
    } finally {
      setSavingTargetId(null);
    }
  }

  async function sync(
    target: DeploymentTarget,
  ): Promise<DeploymentTarget | null> {
    setSyncingTargetId(target.id);
    setMessage(null);
    setStatus("loading");
    try {
      const response = await projectsRepository.syncDeploymentTarget(
        projectId,
        target.id,
      );
      onTargetChanged(response.target);
      setMessage(targetSyncMessage(response));
      setStatus("ready");
      return response.target;
    } catch {
      setMessage("Unable to sync target metadata.");
      setStatus("error");
      return null;
    } finally {
      setSyncingTargetId(null);
    }
  }

  async function detach(
    target: DeploymentTarget,
    deleteProviderResource: boolean,
  ): Promise<boolean> {
    setDetachingTargetId(target.id);
    setMessage(null);
    setStatus("loading");
    try {
      const response = await projectsRepository.detachDeploymentTarget(
        projectId,
        target.id,
        deleteProviderResource,
      );
      onDetached(target.id);
      setMessage(targetDetachMessage(response, target));
      setStatus("ready");
      return true;
    } catch {
      setMessage("Unable to detach deployment target.");
      setStatus("error");
      return false;
    } finally {
      setDetachingTargetId(null);
    }
  }

  return {
    status,
    message,
    savingTargetId,
    syncingTargetId,
    detachingTargetId,
    save,
    sync,
    detach,
    setMessage,
    clearMessage: () => setMessage(null),
  };
}

function trimmedTargetValues(
  values: UpdateDeploymentTargetRequest,
): UpdateDeploymentTargetRequest {
  return {
    ...values,
    rootDirectory: emptyToNull(values.rootDirectory),
    buildCommand: emptyToNull(values.buildCommand),
    startCommand: emptyToNull(values.startCommand),
  };
}
