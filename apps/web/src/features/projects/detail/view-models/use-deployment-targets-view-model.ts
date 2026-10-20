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
import { resumeDoneMessage, rollbackDoneMessage, withRollbackHold } from "../model/deploy-rollback-rules";

export interface DeploymentTargetsViewModel {
  status: ProjectStatus;
  message: string | null;
  /** Set alongside `message` only for a 401 on reinstall: render "Sign in again". */
  signInHref: string | null;
  savingTargetId: string | null;
  syncingTargetId: string | null;
  detachingTargetId: string | null;
  reinstallingTargetId: string | null;
  /** The target a rollback or a resume is running on. */
  rollingBackTargetId: string | null;
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
  /**
   * Puts an earlier deploy back live. Resolves to null on success, else the
   * sentence to show in the dialog that asked.
   */
  rollback: (
    target: DeploymentTarget,
    deploy: { id: string; sha: string | null },
    reason: string,
  ) => Promise<string | null>;
  /** Ends a Vercel rollback hold. Resolves to null on success, else the sentence to show. */
  resumeDeploys: (target: DeploymentTarget) => Promise<string | null>;
  setMessage: (message: string | null) => void;
  clearMessage: () => void;
}

export function useDeploymentTargetsViewModel(options: {
  projectId: string;
  targets: DeploymentTarget[];
  appRole: AppRole | undefined;
  onTargetChanged: (target: DeploymentTarget) => void;
  onDetached: (targetId: string) => void;
  /** Reads the deploy history again after a rollback or a resume changed what is live. */
  onDeploysChanged?: () => void;
}): DeploymentTargetsViewModel {
  const { projectId, targets, appRole, onTargetChanged, onDetached, onDeploysChanged } = options;
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
  const [rollingBackTargetId, setRollingBackTargetId] = useState<string | null>(null);
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

  async function rollback(
    target: DeploymentTarget,
    deploy: { id: string; sha: string | null },
    reason: string,
  ): Promise<string | null> {
    setRollingBackTargetId(target.id);
    setMessage(null);
    try {
      const response = await projectsRepository.rollbackDeploymentTarget(projectId, target.id, {
        deployId: deploy.id,
        reason: reason.trim(),
      });
      onTargetChanged(withRollbackHold(target, response.rollback));
      setMessage(rollbackDoneMessage(target, deploy.sha, response));
      onDeploysChanged?.();
      return null;
    } catch (error) {
      return workspacePermissionErrorMessage(error, "Unable to roll back this deployment.");
    } finally {
      setRollingBackTargetId(null);
    }
  }

  async function resumeDeploys(target: DeploymentTarget): Promise<string | null> {
    setRollingBackTargetId(target.id);
    setMessage(null);
    try {
      await projectsRepository.resumeDeploymentTargetDeploys(projectId, target.id);
      onTargetChanged(withRollbackHold(target, null));
      setMessage(resumeDoneMessage(target));
      onDeploysChanged?.();
      return null;
    } catch (error) {
      return workspacePermissionErrorMessage(error, "Unable to resume deploys.");
    } finally {
      setRollingBackTargetId(null);
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
    rollingBackTargetId,
    targetActions,
    save,
    sync,
    detach,
    reinstallSecrets,
    rollback,
    resumeDeploys,
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
