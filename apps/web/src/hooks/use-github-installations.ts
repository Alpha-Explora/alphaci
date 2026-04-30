"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";

import {
  getGithubInstallationAccounts,
  getGithubAppInstallUrl,
  getLinkedGithubRepos,
  linkGithubInstallation,
} from "@/lib/api/client";
import type { GithubInstallationAccount, LinkedGitHubRepo } from "@/lib/api/contracts";
import { formatApiError } from "@/components/product/workflow-builder-utils";

export function useGithubInstallations(
  setStatusMessage: (message: string) => void,
  applyRepoSelection: (repoFullName: string) => void,
) {
  const [linkedRepos, setLinkedRepos] = useState<LinkedGitHubRepo[]>([]);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState("");
  const [loadingLinkedRepos, setLoadingLinkedRepos] = useState(false);
  const [linkedReposLoaded, setLinkedReposLoaded] = useState(false);
  const [installationAccounts, setInstallationAccounts] = useState<GithubInstallationAccount[]>([]);
  const [loadingInstallationAccounts, setLoadingInstallationAccounts] = useState(false);
  const [installationAccountsLoaded, setInstallationAccountsLoaded] = useState(false);
  const [installUrl, setInstallUrl] = useState<string | null>(null);
  const [loadingInstallUrl, setLoadingInstallUrl] = useState(false);
  const [installationId, setInstallationId] = useState("");
  const [linkingInstallation, setLinkingInstallation] = useState(false);

  const loadLinkedRepos = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingLinkedRepos(true);
    }

    try {
      const response = await getLinkedGithubRepos();
      setLinkedRepos(response.repos);
      setLinkedReposLoaded(true);
    } catch {
      if (!silent) {
        setStatusMessage("Could not load linked GitHub App repos.");
      }
    } finally {
      if (!silent) {
        setLoadingLinkedRepos(false);
      }
    }
  }, [setStatusMessage]);

  const loadInstallationAccounts = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingInstallationAccounts(true);
    }

    try {
      const response = await getGithubInstallationAccounts();
      setInstallationAccounts(response.accounts);
      setInstallationAccountsLoaded(true);
    } catch {
      if (!silent) {
        setStatusMessage("Could not load GitHub App installation accounts.");
      }
    } finally {
      if (!silent) {
        setLoadingInstallationAccounts(false);
      }
    }
  }, [setStatusMessage]);

  useEffect(() => {
    void loadLinkedRepos();
    void loadInstallationAccounts();
  }, [loadInstallationAccounts, loadLinkedRepos]);

  useEffect(() => {
    let active = true;

    async function loadInstallUrl() {
      setLoadingInstallUrl(true);
      try {
        const response = await getGithubAppInstallUrl();
        if (active) {
          setInstallUrl(response.installUrl);
        }
      } catch {
        if (active) {
          setInstallUrl(null);
        }
      } finally {
        if (active) {
          setLoadingInstallUrl(false);
        }
      }
    }

    void loadInstallUrl();

    return () => {
      active = false;
    };
  }, []);

  function handleRepoSelect(event: ChangeEvent<HTMLSelectElement>) {
    const repoName = event.target.value;
    setSelectedRepoFullName(repoName);
    applyRepoSelection(repoName);
  }

  async function handleLinkInstallation() {
    const parsedInstallationId = Number(installationId);
    if (!Number.isInteger(parsedInstallationId) || parsedInstallationId < 1) {
      setStatusMessage("Enter a valid GitHub App installation id.");
      return;
    }

    setLinkingInstallation(true);
    setStatusMessage("Linking GitHub App installation...");

    try {
      const response = await linkGithubInstallation(parsedInstallationId);
      await Promise.all([loadLinkedRepos(true), loadInstallationAccounts(true)]);
      const access =
        response.repositorySelection === "all"
          ? "all repositories"
          : "selected repositories";
      setStatusMessage(
        `Linked ${response.reposLinked} GitHub repo${response.reposLinked === 1 ? "" : "s"}. Installation access: ${access}.`,
      );
    } catch (error) {
      setStatusMessage(formatApiError(error, "GitHub App installation link failed"));
    } finally {
      setLinkingInstallation(false);
    }
  }

  const allRepositoriesAccount =
    installationAccounts.find((account) => account.repositorySelection === "all") ?? null;
  const hasAllRepositoriesInstallation = allRepositoriesAccount !== null;
  const installationStatusCopy = hasAllRepositoriesInstallation
    ? `All repositories access confirmed${allRepositoriesAccount.accountLogin ? ` for @${allRepositoriesAccount.accountLogin}` : ""}.`
    : installationAccountsLoaded && installationAccounts.length > 0
      ? "GitHub App is linked for selected repositories only. Reinstall or update it with all repositories access to create new repos."
      : "Link the GitHub App with all repositories access to create new repos.";

  return {
    allRepositoriesAccount,
    handleLinkInstallation,
    handleRepoSelect,
    hasAllRepositoriesInstallation,
    installUrl,
    installationId,
    installationAccounts,
    installationAccountsLoaded,
    installationStatusCopy,
    linkedRepos,
    linkedReposLoaded,
    linkingInstallation,
    loadInstallationAccounts,
    loadLinkedRepos,
    loadingInstallationAccounts,
    loadingInstallUrl,
    loadingLinkedRepos,
    selectedRepoFullName,
    setInstallationId,
  };
}

export type GithubInstallationsState = ReturnType<typeof useGithubInstallations>;
