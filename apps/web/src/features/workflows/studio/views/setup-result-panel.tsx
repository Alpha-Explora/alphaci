"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useCapabilities } from "@/features/capabilities/current";
import type {
  CreateProjectResult,
  DeploymentProvisioningResult,
  SetupProjectResponse,
  WorkflowFileMetadata,
} from "@/shared/api/contracts";
import { cleanUserMessage } from "../model/workflow-studio-rules";

interface SetupResultPanelProps {
  existingRepoResult?: SetupProjectResponse | null;
  setupResult: CreateProjectResult | null;
  onViewProject: () => void;
}

/** The commit, as text: the repository's own page is not somewhere this app sends people. */
function CommitText({ sha }: Readonly<{ sha: string }>) {
  return <code>{sha.slice(0, 10)}</code>;
}

function SecondaryRepoSection({
  fullName,
}: Readonly<{ fullName: string | undefined }>) {
  if (!fullName) return null;
  return (
    <p className="helper-text" style={{ margin: 0 }}>
      Secondary repo: {fullName}
    </p>
  );
}

/**
 * Where to go from here, inside ALPHACI: the new project's page and its
 * Pipeline tab (on Runs), which is where the first CI run will show up.
 */
function ProjectLinks({ projectId }: Readonly<{ projectId: string }>) {
  const base = `/projects/${encodeURIComponent(projectId)}`;
  return (
    <>
      <Link className="primary-button" href={base}>
        Open project
      </Link>
      <Link className="ghost-button" href={`${base}#pipeline`}>
        Pipeline runs
      </Link>
    </>
  );
}

function WorkflowFilesList({
  files,
}: Readonly<{ files?: WorkflowFileMetadata[] }>) {
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
  return provider === "vercel"
    ? "Vercel"
    : provider === "render"
      ? "Render"
      : provider;
}

function deploymentRouteLabel(
  target: DeploymentProvisioningResult["targets"][number],
) {
  if (target.provider === "render") {
    switch (target.deploymentStrategy) {
      case "render_image_pushed":
        return target.ownershipMode === "byo"
          ? "GitHub Actions image deploy"
          : "Archived managed image deploy";
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
      return target.ownershipMode === "byo"
        ? "Customer managed"
        : "Archived ALPHACI-managed";
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

function renderTargetDetails(
  target: DeploymentProvisioningResult["targets"][number],
) {
  if (target.provider !== "render") return [];
  return [
    formatRenderServiceType(target.renderServiceType),
    formatRenderRuntime(target.renderRuntime),
    target.renderInstanceType,
    target.renderRegion,
    target.renderEnvironmentName,
  ].filter((value): value is string => Boolean(value));
}

function hasRenderDeploymentSecrets(
  target: DeploymentProvisioningResult["targets"][number],
) {
  if (target.provider !== "render") return false;
  const secrets = githubSecretNames(target.providerMetadata);
  return ["API_KEY", "SERVICE_ID", "OWNER_ID"].every((suffix) =>
    secrets.some((secretName) => secretName.endsWith(suffix)),
  );
}

type ProvisionedTargetSummary = DeploymentProvisioningResult["targets"][number];

/**
 * The live URL a provisioned service answers on. Prefers the URL the provider
 * returned at creation (Render stores it in providerMetadata); falls back to
 * each provider's deterministic naming convention.
 */
function provisioningTargetUrl(
  target: ProvisionedTargetSummary,
): string | null {
  if (target.status === "failed") {
    return null;
  }

  if (target.provider === "render") {
    const metadataUrl = target.providerMetadata?.["renderServiceUrl"];
    if (typeof metadataUrl === "string" && metadataUrl.trim()) {
      return metadataUrl.trim();
    }
    return target.providerProjectName
      ? `https://${target.providerProjectName}.onrender.com`
      : null;
  }

  if (target.provider === "vercel") {
    return target.providerProjectName
      ? `https://${target.providerProjectName}.vercel.app`
      : null;
  }

  return null;
}

function ServiceUrlLine({ url }: Readonly<{ url: string }>) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        minWidth: 0,
      }}
    >
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={url}
        style={{
          fontSize: "0.78rem",
          fontFamily: "var(--font-mono, monospace)",
          color: "var(--brand)",
          textDecoration: "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {url.replace(/^https?:\/\//, "")}
      </a>
      <button
        type="button"
        className="ghost-button"
        aria-label="Copy service URL"
        onClick={() => {
          void navigator.clipboard
            .writeText(url)
            .then(() => setCopied(true))
            .catch(() => {
              // Clipboard denied; the visible link stays selectable.
            });
        }}
        style={{
          minHeight: "1.6rem",
          padding: "0.1rem 0.55rem",
          fontSize: "0.7rem",
          flexShrink: 0,
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function provisioningStatusCopy(status: DeploymentProvisioningResult["status"]): string {
  if (status === "completed") return "Provider targets were created.";
  if (status === "partial") return "Some provider provisioning steps need attention.";
  return "Provider provisioning failed.";
}

function TargetEnvSet({
  target,
  envSet,
}: Readonly<{
  target: ProvisionedTargetSummary;
  envSet: ProvisionedTargetSummary["env"][number];
}>) {
  const label =
    envSet.lane === "production"
      ? "production"
      : `preview: ${envSet.gitBranch ?? "branch"}`;
  return (
    <div
      className="deployment-provisioning-summary__env"
      key={`${target.slot}-${envSet.lane}-${envSet.gitBranch ?? ""}`}
    >
      <span>{label}</span>
      <div>
        {envSet.provisioned.map((variable) => (
          <code key={`${variable.key}-ok`}>{variable.key}</code>
        ))}
        {envSet.failed.map((variable) => (
          <code className="failed" key={`${variable.key}-failed`}>
            {variable.key}
            {variable.errorSummary
              ? ` failed: ${cleanUserMessage(variable.errorSummary)}`
              : " failed"}
          </code>
        ))}
      </div>
    </div>
  );
}

function ProvisionedTargetCard({
  target,
  index,
}: Readonly<{
  target: ProvisionedTargetSummary;
  index: number;
}>) {
  const serviceUrl = provisioningTargetUrl(target);
  const details = renderTargetDetails(target);
  const secretNames = githubSecretNames(target.providerMetadata);
  return (
    <article
      className={`deployment-provisioning-summary__target ${target.status}`}
      key={`${target.slot}-${target.provider}-${target.deploymentTargetId ?? index}`}
    >
      <div>
        <strong>{formatProvider(target.provider)}</strong>
        <span>
          {target.providerProjectName ??
            target.providerProjectId ??
            target.slot}
        </span>
      </div>
      <p className="helper-text" style={{ margin: 0 }}>
        {target.slot} - {target.status} - {deploymentRouteLabel(target)}
        {target.errorSummary
          ? ` - ${cleanUserMessage(target.errorSummary)}`
          : ""}
      </p>
      {serviceUrl ? <ServiceUrlLine url={serviceUrl} /> : null}
      {details.length > 0 ? (
        <p className="helper-text" style={{ margin: 0 }}>
          {details.join(" - ")}
        </p>
      ) : null}
      {hasRenderDeploymentSecrets(target) ? (
        <p className="helper-text" style={{ margin: 0 }}>
          Render API deployment secrets installed
        </p>
      ) : null}
      {secretNames.length > 0 ? (
        <div className="deployment-provisioning-summary__env">
          <span>GitHub secrets</span>
          <div>
            {secretNames.map((secretName) => (
              <code key={secretName}>{secretName}</code>
            ))}
          </div>
        </div>
      ) : null}
      {target.env.map((envSet) => (
        <TargetEnvSet
          key={`${target.slot}-${envSet.lane}-${envSet.gitBranch ?? ""}`}
          target={target}
          envSet={envSet}
        />
      ))}
    </article>
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
            {provisioningStatusCopy(result.status)}
          </p>
        </div>
        <span
          className={`deployment-provisioning-summary__status ${result.status}`}
        >
          {result.status}
        </span>
      </div>
      <div className="deployment-provisioning-summary__targets">
        {result.targets.map((target, index) => (
          <ProvisionedTargetCard
            target={target}
            index={index}
            key={`${target.slot}-${target.provider}-${target.deploymentTargetId ?? index}`}
          />
        ))}
      </div>
    </section>
  );
}

function ExistingRepoResultView({
  existingRepoResult,
  onViewProject,
}: Readonly<{
  existingRepoResult: NonNullable<SetupResultPanelProps["existingRepoResult"]>;
  onViewProject: () => void;
}>) {
  return (
    <motion.div
      key={existingRepoResult.githubCommitSha}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
    >
      <div className="result-repo-header">
        <span className="result-status-dot" aria-hidden="true" />
        <span className="result-repo-name">
          {existingRepoResult.repoFullName}
        </span>
      </div>
      <div className="result-branches">
        <span className="branch-chip">{existingRepoResult.status}</span>
      </div>
      <div>
        <p
          className="helper-text"
          style={{
            margin: "0 0 0.3rem",
            fontSize: "0.72rem",
            color: "var(--text-muted)",
          }}
        >
          Workflow file
        </p>
        <div className="terminal-path">{existingRepoResult.workflowPath}</div>
      </div>
      <WorkflowFilesList files={existingRepoResult.workflowFiles} />
      <DeploymentProvisioningSummary
        result={existingRepoResult.deploymentProvisioning}
      />
      <div>
        <p
          className="helper-text"
          style={{
            margin: "0 0 0.3rem",
            fontSize: "0.72rem",
            color: "var(--text-muted)",
          }}
        >
          Commit
        </p>
        <div className="terminal-hash">
          <CommitText sha={existingRepoResult.githubCommitSha} />
        </div>
      </div>
      <div className="result-actions">
        <ProjectLinks projectId={existingRepoResult.id} />
        <button
          className="ghost-button"
          type="button"
          onClick={onViewProject}
        >
          View projects
        </button>
      </div>
      <p
        className="helper-text"
        style={{
          fontSize: "0.78rem",
          color: "var(--text-muted)",
          margin: 0,
        }}
      >
        Workflow committed to <code>{existingRepoResult.workflowPath}</code>{" "}
        on the repository&apos;s default branch. Push to <code>test</code>{" "}
        to trigger your first CI run.
      </p>
    </motion.div>
  );
}

function CreatedProjectResultView({
  setupResult,
  envProvisioningEnabled,
  onViewProject,
}: Readonly<{
  setupResult: CreateProjectResult;
  envProvisioningEnabled: boolean;
  onViewProject: () => void;
}>) {
  return (
    <motion.div
      key={setupResult.repoUrl}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
    >
      <div className="result-repo-header">
        <span className="result-status-dot" aria-hidden="true" />
        <span className="result-repo-name">{setupResult.repoFullName}</span>
      </div>
      <div className="result-branches">
        <span className="branch-chip">{setupResult.status}</span>
        <span className="branch-chip">{setupResult.projectTypeId}</span>
        <span className="branch-chip">{setupResult.workflowRecipeId}</span>
      </div>
      <div>
        <p
          className="helper-text"
          style={{
            margin: "0 0 0.3rem",
            fontSize: "0.72rem",
            color: "var(--text-muted)",
          }}
        >
          Workflow file
        </p>
        <div className="terminal-path">{setupResult.workflowPath}</div>
      </div>
      <WorkflowFilesList files={setupResult.workflowFiles} />
      <DeploymentProvisioningSummary
        result={setupResult.deploymentProvisioning}
      />
      <div>
        <p
          className="helper-text"
          style={{
            margin: "0 0 0.3rem",
            fontSize: "0.72rem",
            color: "var(--text-muted)",
          }}
        >
          Commit
        </p>
        <div className="terminal-hash">
          <CommitText sha={setupResult.githubCommitSha} />
        </div>
      </div>
      <SecondaryRepoSection fullName={setupResult.secondaryRepoFullName} />
      <div className="result-actions">
        <ProjectLinks projectId={setupResult.id} />
        {envProvisioningEnabled ? (
          <button
            className="ghost-button"
            type="button"
            onClick={onViewProject}
          >
            Configure env vars
          </button>
        ) : null}
        <button
          className="ghost-button"
          type="button"
          onClick={onViewProject}
        >
          View projects
        </button>
      </div>
      <p
        className="helper-text"
        style={{
          fontSize: "0.78rem",
          color: "var(--text-muted)",
          margin: 0,
        }}
      >
        Workflow committed to <code>{setupResult.workflowPath}</code> on{" "}
        <code>main</code>. Push to <code>test</code> to trigger your first
        CI run.
      </p>
    </motion.div>
  );
}

export function SetupResultPanel({
  existingRepoResult,
  setupResult,
  onViewProject,
}: Readonly<SetupResultPanelProps>) {
  const { envProvisioningEnabled } = useCapabilities();

  if (!existingRepoResult && !setupResult) return null;

  return (
    <aside
      className={`result-panel${setupResult ? " result-panel--success" : ""}`}
    >
      <p className="cp-section-heading" style={{ marginBottom: "1rem" }}>
        {existingRepoResult ? "CI/CD added" : "Project created"}
      </p>
      <AnimatePresence mode="wait">
        {existingRepoResult ? (
          <ExistingRepoResultView
            existingRepoResult={existingRepoResult}
            onViewProject={onViewProject}
          />
        ) : setupResult ? (
          <CreatedProjectResultView
            setupResult={setupResult}
            envProvisioningEnabled={envProvisioningEnabled}
            onViewProject={onViewProject}
          />
        ) : null}
      </AnimatePresence>
    </aside>
  );
}
