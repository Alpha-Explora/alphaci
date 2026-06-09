"use client";

import { AnimatePresence, motion } from "framer-motion";

import { useCapabilities } from "@/hooks/use-capabilities";
import type {
  CreateProjectResult,
  DeploymentProvisioningResult,
  SetupExistingRepoPrResponse,
  WorkflowFileMetadata,
} from "@/lib/api/contracts";

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

function WorkflowFilesList({ files }: Readonly<{ files?: WorkflowFileMetadata[] }>) {
  if (!files?.length) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
        padding: "0.7rem",
        border: "1px solid var(--border-soft)",
        borderRadius: "8px",
        background: "rgba(0,0,0,0.14)",
      }}
    >
      <p className="helper-text" style={{ margin: 0, fontWeight: 700 }}>
        {files.length} gated workflow stages
      </p>
      {files.map((file) => (
        <div
          key={file.path}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(7rem, auto) 1fr",
            gap: "0.45rem",
            alignItems: "center",
            fontSize: "0.78rem",
          }}
        >
          <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
            {file.name}
          </span>
          <code style={{ color: "var(--text-muted)", wordBreak: "break-all" }}>
            {file.path}
          </code>
        </div>
      ))}
    </div>
  );
}

function formatProvider(provider: string) {
  return provider === "vercel" ? "Vercel" : provider === "render" ? "Render" : provider;
}

export function DeploymentProvisioningSummary({
  result,
}: Readonly<{ result?: DeploymentProvisioningResult }>) {
  if (!result || result.status === "skipped" || result.targets.length === 0) {
    return null;
  }

  return (
    <section className="deployment-provisioning-summary">
      <div className="env-section-header">
        <div>
          <h4>Deployment provisioning</h4>
          <p className="helper-text" style={{ margin: "0.25rem 0 0" }}>
            {result.status === "completed"
              ? "Provider targets were created."
              : result.status === "partial"
                ? "Some provider provisioning steps need attention."
                : "Provider provisioning failed."}
          </p>
        </div>
        <span className={`deployment-provisioning-summary__status ${result.status}`}>
          {result.status}
        </span>
      </div>
      <div className="deployment-provisioning-summary__targets">
        {result.targets.map((target, index) => (
          <article
            className={`deployment-provisioning-summary__target ${target.status}`}
            key={`${target.slot}-${target.provider}-${target.deploymentTargetId ?? index}`}
          >
            <div>
              <strong>{formatProvider(target.provider)}</strong>
              <span>{target.providerProjectName ?? target.providerProjectId ?? target.slot}</span>
            </div>
            <p className="helper-text" style={{ margin: 0 }}>
              {target.slot} - {target.status}
              {target.errorSummary ? ` - ${target.errorSummary}` : ""}
            </p>
            {target.env.map((envSet) => (
              <div className="deployment-provisioning-summary__env" key={`${target.slot}-${envSet.environment}`}>
                <span>{envSet.environment}</span>
                <div>
                  {envSet.provisioned.map((variable) => (
                    <code key={`${variable.key}-ok`}>{variable.key}</code>
                  ))}
                  {envSet.failed.map((variable) => (
                    <code className="failed" key={`${variable.key}-failed`}>
                      {variable.key}
                      {variable.errorSummary ? ` failed: ${variable.errorSummary}` : " failed"}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}

export function SetupResultPanel({
  existingRepoResult,
  setupResult,
  onViewProject,
}: Readonly<SetupResultPanelProps>) {
  const { envProvisioningEnabled } = useCapabilities();
  const repoUrl = existingRepoResult
    ? `https://github.com/${existingRepoResult.repoFullName}`
    : null;

  return (
    <aside className={`result-panel${setupResult ? " result-panel--success" : ""}`}>
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

            <div>
              <p className="helper-text" style={{ margin: "0 0 0.3rem", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                Workflow file
              </p>
              <div className="terminal-path">{setupResult.workflowPath}</div>
            </div>
            <WorkflowFilesList files={setupResult.workflowFiles} />
            <DeploymentProvisioningSummary result={setupResult.deploymentProvisioning} />
            <div>
              <p className="helper-text" style={{ margin: "0 0 0.3rem", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                Commit
              </p>
              <div className="terminal-hash">
                <CommitLink sha={setupResult.githubCommitSha} url={setupResult.githubCommitUrl} />
              </div>
            </div>
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
              {envProvisioningEnabled ? (
                <button className="ghost-button" type="button" onClick={onViewProject}>
                  Configure env vars
                </button>
              ) : null}
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
