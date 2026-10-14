"use client";

import { useEffect, useRef, useState } from "react";

import { projectsRepository } from "../../data/projects-repository";
import type { ProjectStatus } from "../../model/projects-types";
import type {
  AppRole,
  DeploymentTarget,
  DeploymentTargetActionsResponse,
  UpdateDeploymentTargetRequest,
} from "@/shared/api/contracts";
import {
  canReinstallDeploymentSecrets,
  emptyToNull,
  reinstallSecretsFailure,
  reinstallSecretsSuccessMessage,
  targetDetachMessage,
  targetSyncMessage,
} from "../model/project-detail-tab-rules";
import { workspacePermissionErrorMessage } from "../model/workspace-permission-errors";

export interface DeploymentTargetsViewModel {
  status: ProjectStatus;
  message: string | null;
  /** Set alongside `message` only for a 401 on reinstall: render "Sign in again". */
  signInHref: string | null;
  savingTargetId: string | null;
  syncingTargetId: string | null;
  detachingTargetId: string | null;
  reinstallingTargetId: string | null;
  /** Per-target action descriptor, fetched only for viewers who could act on it. */
  targetActions: Record<string, DeploymentTargetActionsResponse>;
  save: (
    targetId: string,
    values: UpdateDeploymentTargetRequest,
  ) => Promise<DeploymentTarget | null>;
  sync: (target: DeploymentTarget) => Promise<DeploymentTarget | null>;
  detach: (
    target: DeploymentTarget,
    deleteProviderResource: boolean,
  ) => Promise<boolean>;
  reinstallSecrets: (target: DeploymentTarget) => Promise<boolean>;
  setMessage: (message: string | null) => void;
  clearMessage: () => void;
}

export function useDeploymentTargetsViewModel(options: {
  projectId: string;
  targets: DeploymentTarget[];
  appRole: AppRole | undefined;
  onTargetChanged: (target: DeploymentTarget) => void;
  onDetached: (targetId: string) => void;
}): DeploymentTargetsViewModel {
  const { projectId, targets, appRole, onTargetChanged, onDetached } = options;
  const [status, setStatus] = useState<ProjectStatus>("ready");
  const [message, setMessage] = useState<string | null>(null);
  const [signInHref, setSignInHref] = useState<string | null>(null);
  const [savingTargetId, setSavingTargetId] = useState<string | null>(null);
  const [syncingTargetId, setSyncingTargetId] = useState<string | null>(null);
  const [detachingTargetId, setDetachingTargetId] = useState<string | null>(
    null,
  );
  const [reinstallingTargetId, setReinstallingTargetId] = useState<
    string | null
  >(null);
  const [targetActions, setTargetActions] = useState<
    Record<string, DeploymentTargetActionsResponse>
  >({});
  const requestedActionIds = useRef<Set<string>>(new Set());

  // Only a Developer/admin can ever see the reinstall button, so only they cause
  // this extra request per target — everyone else never fetches it.
  const canManageSecrets = canReinstallDeploymentSecrets(appRole);

  useEffect(() => {
    if (!canManageSecrets) return;
    const pending = targets.filter(
      (target) => !requestedActionIds.current.has(target.id),
    );
    if (!pending.length) return;

    let active = true;
    for (const target of pending) {
      requestedActionIds.current.add(target.id);
      projectsRepository
        .targetActions(projectId, target.id)
        .then((response) => {
          if (!active) return;
          setTargetActions((current) => ({ ...current, [target.id]: response }));
        })
        .catch(() => {
          // Leave it un-cached: the button just stays hidden for this target.
        });
    }
    return () => {
      active = false;
    };
  }, [canManageSecrets, projectId, targets]);

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
    } catch (error) {
      setMessage(
        workspacePermissionErrorMessage(error, "Unable to update target metadata."),
      );
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
    } catch (error) {
      setMessage(
        workspacePermissionErrorMessage(error, "Unable to sync target metadata."),
      );
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
    } catch (error) {
      setMessage(
        workspacePermissionErrorMessage(error, "Unable to detach deployment target."),
      );
      setStatus("error");
      return false;
    } finally {
      setDetachingTargetId(null);
    }
  }

  async function reinstallSecrets(target: DeploymentTarget): Promise<boolean> {
    setReinstallingTargetId(target.id);
    setMessage(null);
    setSignInHref(null);
    setStatus("loading");
    try {
      const response = await projectsRepository.reinstallDeploymentSecrets(
        projectId,
        target.id,
      );
      setMessage(reinstallSecretsSuccessMessage(response));
      setStatus("ready");
      return true;
    } catch (error) {
      const failure = reinstallSecretsFailure(error, projectId);
      setMessage(failure.message);
      setSignInHref(failure.signInHref);
      setStatus("error");
      return false;
    } finally {
      setReinstallingTargetId(null);
    }
  }

  return {
    status,
    message,
    signInHref,
    savingTargetId,
    syncingTargetId,
    detachingTargetId,
    reinstallingTargetId,
    targetActions,
    save,
    sync,
    detach,
    reinstallSecrets,
    setMessage,
    clearMessage: () => {
      setMessage(null);
      setSignInHref(null);
    },
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
