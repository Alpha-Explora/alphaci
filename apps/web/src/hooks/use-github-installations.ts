"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

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
  const [appSlug, setAppSlug] = useState<string | null>(null);
  const [loadingInstallUrl, setLoadingInstallUrl] = useState(false);
  const [installationId, setInstallationId] = useState("");
  const [selectedOwner, setSelectedOwner] = useState("personal");
  const [linkingInstallation, setLinkingInstallation] = useState(false);
  const autoLinkFiredRef = useRef(false);

  const applyInstallConfig = useCallback((response: { installUrl: string; appSlug?: string }) => {
    const url = new URL(response.installUrl);
    const match = url.pathname.match(/^\/apps\/([a-z0-9-]+)\/installations\/new\/?$/);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || !match) {
      throw new Error("Backend returned an invalid GitHub App installation URL.");
    }
    const normalizedAppSlug = response.appSlug?.trim().toLowerCase() || match[1];
    if (normalizedAppSlug !== match[1]) {
      throw new Error("Backend GitHub App slug does not match its installation URL.");
    }
    setInstallUrl(response.installUrl);
    setAppSlug(normalizedAppSlug);
  }, []);

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
          applyInstallConfig(response);
        }
      } catch {
        if (active) {
          setInstallUrl(null);
          setAppSlug(null);
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
  }, [applyInstallConfig]);

  async function handleInstallApp() {
    const popup = window.open("about:blank", "alphaci-github-app-install");
    if (popup) popup.opener = null;
    setLoadingInstallUrl(true);

    try {
      const response = await getGithubAppInstallUrl();
      applyInstallConfig(response);
      setStatusMessage("");
      if (popup) {
        popup.location.href = response.installUrl;
      } else {
        window.location.assign(response.installUrl);
      }
    } catch (error) {
      popup?.close();
      setInstallUrl(null);
      setAppSlug(null);
      setStatusMessage(formatApiError(error, "GitHub App install link unavailable"));
    } finally {
      setLoadingInstallUrl(false);
    }
  }

  useEffect(() => {
    if (autoLinkFiredRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const urlInstallationId = params.get("installation_id");
    if (!urlInstallationId) return;

    autoLinkFiredRef.current = true;
    setInstallationId(urlInstallationId);

    params.delete("installation_id");
    const remaining = params.toString();
    const cleanUrl = remaining ? `${window.location.pathname}?${remaining}` : window.location.pathname;
    window.history.replaceState(null, "", cleanUrl);

    const parsedId = Number(urlInstallationId);
    if (!Number.isInteger(parsedId) || parsedId < 1) {
      setStatusMessage("GitHub App callback contained an invalid installation ID.");
      return;
    }

    setLinkingInstallation(true);
    setStatusMessage("Linking GitHub App installation from callback...");

    linkGithubInstallation(parsedId)
      .then(async (response) => {
        await Promise.all([loadLinkedRepos(true), loadInstallationAccounts(true)]);
        const access = response.repositorySelection === "all" ? "all repositories" : "selected repositories";
        setStatusMessage(
          `Linked ${response.reposLinked} GitHub repo${response.reposLinked === 1 ? "" : "s"}. Installation access: ${access}.`,
        );
      })
      .catch((error: unknown) => {
        setStatusMessage(formatApiError(error, "GitHub App installation link failed"));
      })
      .finally(() => {
        setLinkingInstallation(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const selectedInstallationId = selectedOwner.startsWith("organization:")
    ? Number(selectedOwner.slice("organization:".length))
    : undefined;
  const selectedOwnerType: "organization" | "personal" = selectedInstallationId
    ? "organization"
    : "personal";

  return {
    allRepositoriesAccount,
    appSlug,
    handleInstallApp,
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
    selectedInstallationId,
    selectedOwner,
    selectedOwnerType,
    setInstallationId,
    setSelectedOwner,
  };
}

export type GithubInstallationsState = ReturnType<typeof useGithubInstallations>;
