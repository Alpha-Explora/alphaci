"use client";

import { AnimatePresence, motion } from "framer-motion";

import type {
  DiscoverExistingRepoResponse,
  ExistingRepoWarning,
  LinkedGitHubRepo,
} from "@/shared/api/contracts";
import { labelAccentStyle } from "./setup-tab-shared";

function linkedRepoSelectPlaceholder(loading: boolean): string {
  if (loading) {
    return "Loading linked repos...";
  }
  return "Choose a repository";
}

function discoverButtonLabel(busy: boolean): string {
  if (busy) {
    return "Scanning...";
  }
  return "Discover repo";
}

function setupButtonLabel(busy: boolean): string {
  if (busy) {
    return "Setting up...";
  }
  return "Set up CI/CD";
}

function LinkedReposEmptyState({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <div className="readiness-empty-state" role="status">
      <strong>No linked GitHub repositories</strong>
      <p>
        Install or link the GitHub App, then retry this mode. You can still switch back to new repository creation.
      </p>
      <button type="button" className="ghost-button" onClick={onRetry}>
        Retry repos
      </button>
    </div>
  );
}

function DiscoveryWarningItem({ warning }: Readonly<{ warning: ExistingRepoWarning }>) {
  const tone = warning.code === "branch_protected" ? "blocking" : "info";
  return (
    <li className={`existing-repo-notice existing-repo-notice--${tone}`}>
      {warning.message}
    </li>
  );
}

function DiscoveryNotices({
  baseBranch,
  warnings,
}: Readonly<{
  baseBranch: string;
  warnings?: ExistingRepoWarning[];
}>) {
  if (!warnings?.length) {
    return (
      <p className="existing-repo-notice existing-repo-notice--ok" role="status">
        Nothing in the way — ALPHACI will commit the workflows to{" "}
        <strong>{baseBranch}</strong> and install its secrets.
      </p>
    );
  }

  return (
    <ul className="existing-repo-notices" role="status">
      {warnings.map((warning) => (
        <DiscoveryWarningItem key={warning.code} warning={warning} />
      ))}
    </ul>
  );
}

function ExistingRepoDiscovery({
  discovery,
}: Readonly<{ discovery: DiscoverExistingRepoResponse | null }>) {
  if (!discovery) {
    return null;
  }

  return (
    <>
      <div className="result-branches">
        <span className="branch-chip">{discovery.baseBranch}</span>
        <span className="branch-chip">
          {discovery.detectedProjectTypeId ?? "manual"}
        </span>
        <span className="branch-chip">{discovery.recommendedWorkflowRecipeId}</span>
      </div>

      {/*
        What setup is about to do to a repository that already has
        work in it, said while the user can still change their mind.
        Onboarding commits files and installs secrets; discovering
        a protected branch or an existing SonarCloud setup AFTER
        the fact is too late to be useful.
      */}
      <DiscoveryNotices
        baseBranch={discovery.baseBranch}
        warnings={discovery.warnings}
      />
    </>
  );
}

function ExistingRepoSetupFields({
  enforcedOrgLinkedRepos,
  existingDiscoverDisabled,
  existingRepoBaseBranch,
  existingRepoDiscovery,
  existingRepoFullName,
  existingSetupDisabled,
  isDiscoveringExistingRepo,
  isSettingUpExistingRepo,
  loadingLinkedRepos,
  noLinkedRepos,
  onChangeExistingRepoBaseBranch,
  onChangeExistingRepoFullName,
  onDiscoverExistingRepo,
  onRetryLinkedRepos,
  onSetupExistingRepo,
}: Readonly<ExistingRepoSetupPanelProps>) {
  return (
    <motion.div
      key="existing-mode"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ display: "grid", gap: "1rem" }}
    >
      {noLinkedRepos ? (
        <LinkedReposEmptyState onRetry={() => void onRetryLinkedRepos()} />
      ) : null}

      <div className="form-pair-row" style={{ gap: "1rem" }}>
        <div>
          <label className="input-label" htmlFor="existing-repo-select" style={labelAccentStyle}>
            Linked repository
          </label>
          <select
            id="existing-repo-select"
            value={existingRepoFullName}
            onChange={(event) => onChangeExistingRepoFullName(event.target.value)}
            disabled={loadingLinkedRepos}
            className="premium-input"
          >
            <option value="">
              {linkedRepoSelectPlaceholder(loadingLinkedRepos)}
            </option>
            {enforcedOrgLinkedRepos.map((repo) => (
              <option key={`${repo.installationId}-${repo.repoFullName}`} value={repo.repoFullName}>
                {repo.repoFullName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="input-label" htmlFor="existing-base-branch" style={labelAccentStyle}>
            Base branch
          </label>
          <input
            id="existing-base-branch"
            value={existingRepoBaseBranch}
            onChange={(event) => onChangeExistingRepoBaseBranch(event.target.value)}
            placeholder="Detected from the repository"
            className="premium-input"
          />
        </div>
      </div>

      <p className="helper-text" id="existing-repo-disabled-help" style={{ margin: 0, fontSize: "0.82rem" }}>
        Scan the repository to detect its project type, then set up CI/CD workflows. ALPHACI works against the dev branch (or uat when there is no dev) and never touches main. Leave the base branch blank to let ALPHACI choose.
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="ghost-button"
          style={{ fontSize: "0.875rem", minHeight: "2.6rem", padding: "0.6rem 1.25rem" }}
          disabled={existingDiscoverDisabled}
          aria-describedby="existing-repo-disabled-help"
          onClick={() => void onDiscoverExistingRepo()}
        >
          {discoverButtonLabel(isDiscoveringExistingRepo)}
        </button>
        <button
          type="button"
          className="primary-button"
          style={{ flex: "1", fontSize: "0.875rem", minHeight: "2.6rem", padding: "0.6rem 1.25rem" }}
          disabled={existingSetupDisabled}
          aria-describedby="existing-repo-disabled-help"
          onClick={() => void onSetupExistingRepo()}
        >
          {setupButtonLabel(isSettingUpExistingRepo)}
        </button>
      </div>

      <ExistingRepoDiscovery discovery={existingRepoDiscovery} />
    </motion.div>
  );
}

export interface ExistingRepoSetupPanelProps {
  enforcedOrgLinkedRepos: LinkedGitHubRepo[];
  existingDiscoverDisabled: boolean;
  existingRepoBaseBranch: string;
  existingRepoDiscovery: DiscoverExistingRepoResponse | null;
  existingRepoFullName: string;
  existingSetupDisabled: boolean;
  isDiscoveringExistingRepo: boolean;
  isExistingMode: boolean;
  isSettingUpExistingRepo: boolean;
  loadingLinkedRepos: boolean;
  noLinkedRepos: boolean;
  onChangeExistingRepoBaseBranch: (value: string) => void;
  onChangeExistingRepoFullName: (value: string) => void;
  onDiscoverExistingRepo: () => void;
  onRetryLinkedRepos: () => void;
  onSetupExistingRepo: () => void;
}

export function ExistingRepoSetupPanel(props: Readonly<ExistingRepoSetupPanelProps>) {
  return (
    <AnimatePresence mode="wait">
      {props.isExistingMode ? <ExistingRepoSetupFields {...props} /> : null}
    </AnimatePresence>
  );
}
