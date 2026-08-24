"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { projectsRepository } from "../../data/projects-repository";
import type {
  CustomDomain,
  ProjectStatus,
} from "../../model/projects-types";

export interface ProjectDomainsViewModel {
  domains: CustomDomain[];
  status: ProjectStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  /** Id of the domain currently being verified or removed, if any. */
  busyDomainId: string | null;
  isAdding: boolean;
  addDomain: (
    deploymentTargetId: string,
    hostname: string,
    gitBranch: string,
  ) => Promise<boolean>;
  verifyDomain: (domainId: string) => Promise<void>;
  removeDomain: (domainId: string) => Promise<void>;
  reload: () => void;
}

/** ViewModel for a project's custom domains. */
export function useProjectDomainsViewModel(options: {
  projectId: string;
  enabled: boolean;
}): ProjectDomainsViewModel {
  const { projectId, enabled } = options;

  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [status, setStatus] = useState<ProjectStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busyDomainId, setBusyDomainId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [nonce, setNonce] = useState(0);

  // A counter rather than a bare flag: adding a domain reloads the list, and a
  // slower earlier read must not overwrite the newer one.
  const req = useRef(0);

  useEffect(() => {
    if (!enabled || !projectId) return;

    req.current += 1;
    const id = req.current;
    let active = true;

    projectsRepository
      .domains(projectId)
      .then((response) => {
        if (!active || id !== req.current) return;
        setDomains(response);
        setError(null);
        setStatus("ready");
      })
      .catch(() => {
        if (!active || id !== req.current) return;
        setError("Could not load domains. Please retry.");
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [projectId, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  /**
   * Resolves true when the domain was attached, so the view knows whether to
   * clear its form. The provider's own message is surfaced rather than a
   * generic failure — "already assigned to another project" tells the reader
   * what to do; "could not add domain" does not.
   */
  async function addDomain(
    deploymentTargetId: string,
    hostname: string,
    gitBranch: string,
  ): Promise<boolean> {
    setIsAdding(true);
    setError(null);
    try {
      const branch = gitBranch.trim();
      await projectsRepository.addDomain(projectId, {
        deploymentTargetId,
        hostname: hostname.trim(),
        ...(branch ? { gitBranch: branch } : {}),
      });
      reload();
      return true;
    } catch (cause) {
      setError(messageFor(cause, "Could not add that domain."));
      return false;
    } finally {
      setIsAdding(false);
    }
  }

  async function verifyDomain(domainId: string): Promise<void> {
    setBusyDomainId(domainId);
    setError(null);
    try {
      const updated = await projectsRepository.verifyDomain(
        projectId,
        domainId,
      );
      setDomains((current) =>
        current.map((domain) => (domain.id === domainId ? updated : domain)),
      );
    } catch (cause) {
      setError(messageFor(cause, "Could not check that domain."));
    } finally {
      setBusyDomainId(null);
    }
  }

  async function removeDomain(domainId: string): Promise<void> {
    setBusyDomainId(domainId);
    setError(null);
    try {
      const result = await projectsRepository.removeDomain(projectId, domainId);
      setDomains((current) =>
        current.filter((domain) => domain.id !== domainId),
      );
      // The row is gone either way; if the provider call failed the hostname
      // is still attached there and the reader has to remove it manually.
      if (result.providerError) {
        setError(
          `${result.hostname} was detached here, but the provider could not be updated: ${result.providerError}`,
        );
      }
    } catch (cause) {
      setError(messageFor(cause, "Could not remove that domain."));
    } finally {
      setBusyDomainId(null);
    }
  }

  return {
    domains,
    status,
    error,
    busyDomainId,
    isAdding,
    addDomain,
    verifyDomain,
    removeDomain,
    reload,
  };
}

function messageFor(cause: unknown, fallback: string): string {
  const message = (cause as { message?: unknown })?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}
