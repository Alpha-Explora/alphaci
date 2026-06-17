"use client";

import { AnimatePresence, motion } from "framer-motion";

import { useCapabilities } from "@/hooks/use-capabilities";
import type {
  CreateProjectResult,
  DeploymentProvisioningResult,
  SetupExistingRepoPrResponse,
  WorkflowFileMetadata,
} from "@/lib/api/contracts";
import { cleanUserMessage } from "./workflow-builder-utils";

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

function deploymentRouteLabel(target: DeploymentProvisioningResult["targets"][number]) {
  if (target.provider === "render") {
    switch (target.deploymentStrategy) {
      case "render_image_pushed":
        return target.ownershipMode === "byo" ? "GitHub Actions image deploy" : "Managed image deploy";
      case "render_git_connected":
        return "Native Render build";
      case "render_existing_service":
        return "Existing Render service";
      default:
        break;
    }
  }

  switch (target.deploymentStrategy) {
    case "vercel_git_connected":
      return "Connected through Vercel Git";
    case "vercel_ci_pushed":
      return "Deploys through GitHub Actions";
    case "provider_native":
      return "Provider native";
    default:
      return target.ownershipMode === "byo" ? "Customer managed" : "Managed by AlphaCI";
  }
}

function githubSecretNames(metadata: Record<string, unknown> | undefined) {
  const githubSecrets = metadata?.githubSecrets;
  if (!githubSecrets || typeof githubSecrets !== "object") return [];
  return Object.values(githubSecrets as Record<string, unknown>).filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

function formatRenderServiceType(value: string | null | undefined) {
  if (!value) return null;
  return value.replace(/_/g, " ");
}

function formatRenderRuntime(value: string | null | undefined) {
  if (!value) return null;
  if (value === "node") return "Node.js / Bun";
  if (value === "docker") return "Dockerfile";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function renderTargetDetails(target: DeploymentProvisioningResult["targets"][number]) {
  if (target.provider !== "render") return [];
  return [
    formatRenderServiceType(target.renderServiceType),
    formatRenderRuntime(target.renderRuntime),
    target.renderInstanceType,
    target.renderRegion,
    target.renderEnvironmentName,
  ].filter((value): value is string => Boolean(value));
}

function hasRenderDeploymentSecrets(target: DeploymentProvisioningResult["targets"][number]) {
  if (target.provider !== "render") return false;
  const secrets = githubSecretNames(target.providerMetadata);
  return ["API_KEY", "SERVICE_ID", "OWNER_ID"].every((suffix) =>
    secrets.some((secretName) => secretName.endsWith(suffix)),
  );
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
              {target.slot} - {target.status} - {deploymentRouteLabel(target)}
              {target.errorSummary ? ` - ${cleanUserMessage(target.errorSummary)}` : ""}
            </p>
            {renderTargetDetails(target).length > 0 ? (
              <p className="helper-text" style={{ margin: 0 }}>
                {renderTargetDetails(target).join(" - ")}
              </p>
            ) : null}
            {hasRenderDeploymentSecrets(target) ? (
              <p className="helper-text" style={{ margin: 0 }}>
                Render API deployment secrets installed
              </p>
            ) : null}
            {githubSecretNames(target.providerMetadata).length > 0 ? (
              <div className="deployment-provisioning-summary__env">
                <span>GitHub secrets</span>
                <div>
                  {githubSecretNames(target.providerMetadata).map((secretName) => (
                    <code key={secretName}>{secretName}</code>
                  ))}
                </div>
              </div>
            ) : null}
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
                      {variable.errorSummary ? ` failed: ${cleanUserMessage(variable.errorSummary)}` : " failed"}
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

  if (!existingRepoResult && !setupResult) return null;

  const repoUrl = existingRepoResult
    ? `https://github.com/${existingRepoResult.repoFullName}`
    : null;

  return (
    <aside className={`result-panel${setupResult ? " result-panel--success" : ""}`}>
      <p className="cp-section-heading" style={{ marginBottom: "1rem" }}>
        {existingRepoResult ? "Pull request created" : "Project created"}
      </p>
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
        ) : null}
      </AnimatePresence>
    </aside>
  );
}
