"use client";

import { useEffect, useRef, useState } from "react";

import type { AppRole, DeploymentTarget, EnvTargetSlot } from "@/shared/api/contracts";
import type { ProjectStatus } from "../../model/projects-types";
import {
  getDeploymentProviders,
  getProjectEnvironments,
  getProjectReleases,
  createOnpremEnvironmentTarget,
  promoteRelease,
  registerOnpremHost,
} from "../data/environments-api";
import { apiErrorReason } from "../model/api-error-reason";
import {
  buildEnvironmentRows,
  onpremHostsEnabled,
  type DeploymentProviderSummary,
  type EnvironmentRow,
  type ProjectEnvironment,
  type ProjectRelease,
  canPromoteEnvironment,
} from "../model/environment-operations";

export interface EnvironmentMessage {
  environmentId: string;
  tone: "error" | "info";
  text: string;
}

export interface EnvironmentOperationsViewModel {
  status: ProjectStatus;
  loadError: string | null;
  /** Why release history is missing, when environments loaded without it. */
  releasesNote: string | null;
  rows: EnvironmentRow[];
  hostsEnabled: boolean;
  canManageHosts: boolean;
  canPromote: (production: boolean) => boolean;
  busyEnvironmentId: string | null;
  confirmingEnvironmentId: string | null;
  message: EnvironmentMessage | null;
  hostToken: { environmentId: string; token: string } | null;
  promote: (row: EnvironmentRow) => Promise<void>;
  cancelPromotion: () => void;
  registerHost: (environmentId: string, name: string) => Promise<void>;
  addOnpremTarget: (
    environmentId: string,
    slot: EnvTargetSlot,
    name: string,
  ) => Promise<void>;
  dismissHostToken: () => void;
}

interface Loaded {
  environments: ProjectEnvironment[];
  releases: ProjectRelease[];
  releasesNote: string | null;
  providers: DeploymentProviderSummary[];
}

async function loadOperations(projectId: string): Promise<Loaded> {
  const [environments, releases, providers] = await Promise.all([
    getProjectEnvironments(projectId),
    getProjectReleases(projectId).then(
      (items) => ({ items, note: null as string | null }),
      (error: unknown) => ({
        items: [] as ProjectRelease[],
        note: apiErrorReason(error, "Release history is unavailable."),
      }),
    ),
    getDeploymentProviders().catch(() => [] as DeploymentProviderSummary[]),
  ]);
  return {
    environments,
    releases: releases.items,
    releasesNote: releases.note,
    providers,
  };
}

export function useEnvironmentOperationsViewModel(options: {
  projectId: string;
  targets: readonly DeploymentTarget[];
  appRole?: AppRole | null;
  onTargetCreated?: (target: DeploymentTarget) => void;
}): EnvironmentOperationsViewModel {
  const { projectId, targets, appRole, onTargetCreated } = options;
  const [status, setStatus] = useState<ProjectStatus>("loading");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [busyEnvironmentId, setBusyEnvironmentId] = useState<string | null>(
    null,
  );
  const [confirmingEnvironmentId, setConfirmingEnvironmentId] = useState<
    string | null
  >(null);
  const [message, setMessage] = useState<EnvironmentMessage | null>(null);
  const [hostToken, setHostToken] =
    useState<EnvironmentOperationsViewModel["hostToken"]>(null);
  const requests = useRef(0);

  useEffect(() => {
    requests.current += 1;
    const id = requests.current;
    loadOperations(projectId)
      .then((result) => {
        if (id !== requests.current) return;
        setLoaded(result);
        setLoadError(null);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (id !== requests.current) return;
        setLoadError(apiErrorReason(error, "Unable to load environments."));
        setStatus("error");
      });
  }, [projectId, reloads]);

  const rows = loaded
    ? buildEnvironmentRows({
        environments: loaded.environments,
        releases: loaded.releases,
        targets,
        providers: loaded.providers,
      })
    : [];

  async function promote(row: EnvironmentRow) {
    if (row.promotion.kind !== "available") return;
    const environmentId = row.environment.id;
    // Production asks once more; the second click is the confirmation.
    if (
      row.environment.role === "production" &&
      confirmingEnvironmentId !== environmentId
    ) {
      setConfirmingEnvironmentId(environmentId);
      return;
    }
    setConfirmingEnvironmentId(null);
    setBusyEnvironmentId(environmentId);
    setMessage(null);
    try {
      await promoteRelease(projectId, environmentId, row.promotion.release.releaseId);
      setMessage({
        environmentId,
        tone: "info",
        text: row.hostDelivered
          ? "Promotion started. The on-prem host will pick it up on its next poll."
          : "Promotion started.",
      });
      setReloads((count) => count + 1);
    } catch (error) {
      setMessage({
        environmentId,
        tone: "error",
        text: apiErrorReason(error, "The promotion was refused."),
      });
    } finally {
      setBusyEnvironmentId(null);
    }
  }

  async function registerHost(environmentId: string, name: string) {
    setBusyEnvironmentId(environmentId);
    setMessage(null);
    try {
      const host = await registerOnpremHost(projectId, environmentId, name);
      setHostToken({ environmentId, token: host.token });
    } catch (error) {
      setMessage({
        environmentId,
        tone: "error",
        text: apiErrorReason(error, "Unable to register the host."),
      });
    } finally {
      setBusyEnvironmentId(null);
    }
  }

  async function addOnpremTarget(
    environmentId: string,
    slot: EnvTargetSlot,
    name: string,
  ) {
    setBusyEnvironmentId(environmentId);
    setMessage(null);
    try {
      const target = await createOnpremEnvironmentTarget(projectId, {
        environmentId,
        slot,
        name,
      });
      onTargetCreated?.(target);
      setMessage({
        environmentId,
        tone: "info",
        text: `${slot} on-prem target added. Register a host to receive releases.`,
      });
      setReloads((count) => count + 1);
    } catch (error) {
      setMessage({
        environmentId,
        tone: "error",
        text: apiErrorReason(error, "Unable to add the on-prem target."),
      });
    } finally {
      setBusyEnvironmentId(null);
    }
  }

  return {
    status,
    loadError,
    releasesNote: loaded?.releasesNote ?? null,
    rows,
    hostsEnabled: loaded ? onpremHostsEnabled(loaded.providers) : false,
    canManageHosts: appRole === "member" || appRole === "admin",
    canPromote: (production) => canPromoteEnvironment(appRole, production),
    busyEnvironmentId,
    confirmingEnvironmentId,
    message,
    hostToken,
    promote: async (row) => {
      if (!canPromoteEnvironment(appRole, row.environment.role === "production")) return;
      await promote(row);
    },
    cancelPromotion: () => setConfirmingEnvironmentId(null),
    registerHost,
    addOnpremTarget,
    dismissHostToken: () => setHostToken(null),
  };
}
