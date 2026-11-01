"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

import {
  getGithubInstallationAccounts,
  getGithubAppInstallUrl,
  getLinkedGithubRepos,
  linkGithubInstallation,
} from "@/features/workflows/studio/data/github-api";
import type { GithubInstallationAccount, LinkedGitHubRepo } from "@/shared/api/contracts";
import { formatApiError } from "../model/workflow-studio-rules";
import { roleGateErrorMessage } from "../model/role-gate-rules";
import { navigateToExternalUrl } from "./navigation";

/** The `installation_id` GitHub's install redirect left in the URL, if any. */
function callbackInstallationId(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("installation_id");
}

function isInstallationId(value: string | null): boolean {
  const parsed = Number(value);
  return value !== null && Number.isInteger(parsed) && parsed >= 1;
}

export function useGithubInstallations(
  setStatusMessage: (message: string) => void,
  applyRepoSelection: (repoFullName: string) => void,
) {
  const [linkedRepos, setLinkedRepos] = useState<LinkedGitHubRepo[]>([]);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState("");
  // The mount effect starts both reads, so both are loading from the first render.
  const [loadingLinkedRepos, setLoadingLinkedRepos] = useState(true);
  const [linkedReposLoaded, setLinkedReposLoaded] = useState(false);
  const [installationAccounts, setInstallationAccounts] = useState<GithubInstallationAccount[]>([]);
  const [loadingInstallationAccounts, setLoadingInstallationAccounts] = useState(true);
  const [installationAccountsLoaded, setInstallationAccountsLoaded] = useState(false);
  const [installUrl, setInstallUrl] = useState<string | null>(null);
  const [appSlug, setAppSlug] = useState<string | null>(null);
  const [loadingInstallUrl, setLoadingInstallUrl] = useState(false);
  // A GitHub install redirect carries the installation to link: the callback
  // effect below links it, so it starts as the typed id and as linking.
  // Neither value is rendered, so the server render's defaults cannot mismatch.
  const [installationId, setInstallationId] = useState(() => callbackInstallationId() ?? "");
  const [selectedOwner, setSelectedOwner] = useState("personal");
  const [linkingInstallation, setLinkingInstallation] = useState(() =>
    isInstallationId(callbackInstallationId()),
  );
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

  const buildInstallRedirectUrl = useCallback((installUrl: string) => {
    const url = new URL(installUrl);
    const returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    url.searchParams.set("state", returnPath || "/");
    return url.toString();
  }, []);

  /**
   * Reads linked repos; a loud read also ends the loading state it was started
   * under. State is only written from the answer, never before the request.
   */
  const readLinkedRepos = useCallback(
    (silent: boolean): Promise<void> =>
      getLinkedGithubRepos()
        .then(
          (response) => {
            setLinkedRepos(response.repos);
            setLinkedReposLoaded(true);
          },
          () => {
            if (!silent) {
              setStatusMessage("Could not load linked GitHub App repos.");
            }
          },
        )
        .finally(() => {
          if (!silent) {
            setLoadingLinkedRepos(false);
          }
        }),
    [setStatusMessage],
  );

  /**
   * Reads installation accounts; a loud read also ends the loading state it
   * was started under. State is only written from the answer.
   */
  const readInstallationAccounts = useCallback(
    (silent: boolean): Promise<void> =>
      getGithubInstallationAccounts()
        .then(
          (response) => {
            setInstallationAccounts(response.accounts);
            setInstallationAccountsLoaded(true);
          },
          () => {
            if (!silent) {
              setStatusMessage("Could not load GitHub App installation accounts.");
            }
          },
        )
        .finally(() => {
          if (!silent) {
            setLoadingInstallationAccounts(false);
          }
        }),
    [setStatusMessage],
  );

  useEffect(() => {
    void readLinkedRepos(false);
    void readInstallationAccounts(false);
  }, [readInstallationAccounts, readLinkedRepos]);

  const loadLinkedRepos = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingLinkedRepos(true);
    }
    await readLinkedRepos(silent);
  }, [readLinkedRepos]);

  const loadInstallationAccounts = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingInstallationAccounts(true);
    }
    await readInstallationAccounts(silent);
  }, [readInstallationAccounts]);

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
    setLoadingInstallUrl(true);

    try {
      const response = await getGithubAppInstallUrl();
      applyInstallConfig(response);
      setStatusMessage("");
      navigateToExternalUrl(buildInstallRedirectUrl(response.installUrl));
    } catch (error) {
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

    // installationId and linkingInstallation already start from this param.
    autoLinkFiredRef.current = true;

    params.delete("installation_id");
    params.delete("setup_action");
    params.delete("state");
    const remaining = params.toString();
    const cleanUrl = remaining ? `${window.location.pathname}?${remaining}` : window.location.pathname;
    window.history.replaceState(null, "", cleanUrl);

    if (!isInstallationId(urlInstallationId)) {
      setStatusMessage("GitHub App callback contained an invalid installation ID.");
      return;
    }

    setStatusMessage("Linking GitHub App installation from callback...");

    linkGithubInstallation(Number(urlInstallationId))
      .then(async (response) => {
        await Promise.all([loadLinkedRepos(true), loadInstallationAccounts(true)]);
        const access = response.repositorySelection === "all" ? "all repositories" : "selected repositories";
        setStatusMessage(
          `Linked ${response.reposLinked} GitHub repo${response.reposLinked === 1 ? "" : "s"}. Installation access: ${access}.`,
        );
      })
      .catch((error: unknown) => {
        setStatusMessage(roleGateErrorMessage(error, "GitHub App installation link failed"));
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
      setStatusMessage(roleGateErrorMessage(error, "GitHub App installation link failed"));
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
