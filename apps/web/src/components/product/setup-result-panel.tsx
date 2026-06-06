"use client";

import { AnimatePresence, motion } from "framer-motion";

import type { CreateProjectResult, SetupExistingRepoPrResponse } from "@/lib/api/contracts";

interface SetupResultPanelProps {
  existingRepoResult?: SetupExistingRepoPrResponse | null;
  setupResult: CreateProjectResult | null;
  onViewProject: () => void;
}

interface CommitLinkProps {
  sha: string;
  url: string | null;
}

function CommitLink({ sha, url }: Readonly<CommitLinkProps>) {
  const short = sha.slice(0, 10);
  if (url) {
    return <a href={url} target="_blank" rel="noreferrer"><code>{short}</code></a>;
  }
  return <code>{short}</code>;
}

interface SecondaryRepoSectionProps {
  url: string | undefined;
  fullName: string | undefined;
}

function SecondaryRepoSection({ url, fullName }: Readonly<SecondaryRepoSectionProps>) {
  if (!url) return null;
  return (
    <p className="helper-text" style={{ margin: 0 }}>
      Secondary repo:{" "}
      <a href={url} target="_blank" rel="noreferrer">{fullName}</a>
    </p>
  );
}

interface SecondaryRepoLinkProps {
  url: string | undefined;
}

function SecondaryRepoLink({ url }: Readonly<SecondaryRepoLinkProps>) {
  if (!url) return null;
  return (
    <a className="ghost-button" href={url} target="_blank" rel="noreferrer">
      Open secondary repo
    </a>
  );
}

export function SetupResultPanel({
  existingRepoResult,
  setupResult,
  onViewProject,
}: Readonly<SetupResultPanelProps>) {
  const repoUrl = existingRepoResult
    ? `https://github.com/${existingRepoResult.repoFullName}`
    : null;

  return (
    <aside className="result-panel">
      <h2>{existingRepoResult ? "Latest Pull Request" : "Latest Project"}</h2>
      <AnimatePresence mode="wait">
        {existingRepoResult ? (
          <motion.div
            key={existingRepoResult.pullRequestUrl}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <div className="result-repo-header">
              <span className="result-status-dot" aria-hidden="true" />
              <a
                href={repoUrl ?? existingRepoResult.pullRequestUrl}
                target="_blank"
                rel="noreferrer"
                className="result-repo-name"
              >
                {existingRepoResult.repoFullName}
              </a>
            </div>

            <div className="result-branches">
              <span className="branch-chip">pull request</span>
              <span className="branch-chip">#{existingRepoResult.pullRequestNumber}</span>
              <span className="branch-chip">{existingRepoResult.branchName}</span>
            </div>

            <p className="helper-text" style={{ margin: 0 }}>
              Workflow: <strong>{existingRepoResult.workflowPath}</strong>
            </p>

            <div className="result-actions">
              <a className="primary-button" href={existingRepoResult.pullRequestUrl} target="_blank" rel="noreferrer">
                Open PR
              </a>
              {repoUrl ? (
                <a
                  className="ghost-button"
                  href={`${repoUrl}/tree/${existingRepoResult.branchName}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View branch
                </a>
              ) : null}
              <button className="ghost-button" type="button" onClick={onViewProject}>
                View projects
              </button>
            </div>

            <p className="helper-text" style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
              Workflow added on <code>{existingRepoResult.branchName}</code>. Merge the PR to apply it to the selected base branch.
            </p>
          </motion.div>
        ) : setupResult ? (
          <motion.div
            key={setupResult.repoUrl}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <div className="result-repo-header">
              <span className="result-status-dot" aria-hidden="true" />
              <a
                href={setupResult.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="result-repo-name"
              >
                {setupResult.repoFullName}
              </a>
            </div>

            <div className="result-branches">
              <span className="branch-chip">{setupResult.status}</span>
              <span className="branch-chip">{setupResult.projectTypeId}</span>
              <span className="branch-chip">{setupResult.workflowRecipeId}</span>
            </div>

            <p className="helper-text" style={{ margin: 0 }}>
              Workflow: <strong>{setupResult.outputFileName}</strong>
            </p>
            <p className="helper-text" style={{ margin: 0 }}>
              Commit:{" "}
              <CommitLink sha={setupResult.githubCommitSha} url={setupResult.githubCommitUrl} />
            </p>
            <SecondaryRepoSection
              url={setupResult.secondaryRepoUrl}
              fullName={setupResult.secondaryRepoFullName}
            />

            <div className="result-actions">
              <a className="primary-button" href={setupResult.repoUrl} target="_blank" rel="noreferrer">
                Open repo
              </a>
              <a
                className="ghost-button"
                href={`${setupResult.repoUrl}/blob/main/${setupResult.workflowPath}`}
                target="_blank"
                rel="noreferrer"
              >
                View workflow
              </a>
              <SecondaryRepoLink url={setupResult.secondaryRepoUrl} />
              <button className="ghost-button" type="button" onClick={onViewProject}>
                View projects
              </button>
            </div>

            <p className="helper-text" style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
              Workflow committed to <code>{setupResult.workflowPath}</code> on <code>main</code>.
              Push to <code>test</code> to trigger your first CI run.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="setup-placeholder"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.65rem",
              padding: "1.6rem 0.8rem",
              textAlign: "center",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "2.8rem",
                height: "2.8rem",
                borderRadius: "0.74rem",
                background: "rgba(59,142,240,0.08)",
                border: "1px solid rgba(59,142,240,0.2)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--brand)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="4 17 10 11 4 5"/>
                <line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
            </span>
            <p className="helper-text" style={{ maxWidth: "28ch", margin: 0 }}>
              Enter a repo name, choose a project type, and click Create GitHub Repository.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
