"use client";

import { formatDate } from "@/features/workflows";
import type {
  ProjectDeploymentHistoryItem,
  ProjectDeploymentsResponse,
} from "@/shared/api/contracts";
import { providerDisplayName } from "../model/provider-urls";
import { deploymentRowClass } from "../model/project-detail-tab-rules";

export function DeploymentHistoryList({
  response,
}: Readonly<{ response: ProjectDeploymentsResponse | null }>) {
  if (!response) {
    return <p className="env-empty-state">Loading deployment history...</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <DeploymentHistoryBanners response={response} />
      <DeploymentHistoryBody deployments={response.deployments} />
    </div>
  );
}

function DeploymentHistoryBanners({
  response,
}: Readonly<{ response: ProjectDeploymentsResponse }>) {
  return (
    <>
      <DeploymentLiveOffBanner
        liveProvidersEnabled={response.liveProvidersEnabled}
      />
      <DeploymentMockBanner
        liveProvidersEnabled={response.liveProvidersEnabled}
        mode={response.mode}
      />
      <DeploymentProviderError error={response.providerError} />
    </>
  );
}

function DeploymentLiveOffBanner({
  liveProvidersEnabled,
}: Readonly<{ liveProvidersEnabled: boolean }>) {
  if (liveProvidersEnabled) return null;
  return (
    <p className="env-empty-state" style={{ margin: 0 }}>
      Live deployment sync is not enabled
    </p>
  );
}

function DeploymentMockBanner({
  liveProvidersEnabled,
  mode,
}: Readonly<{ liveProvidersEnabled: boolean; mode: string }>) {
  if (!liveProvidersEnabled || mode !== "local_mock") return null;
  return (
    <p className="env-empty-state" style={{ margin: 0 }}>
      Live sync is enabled, but no provider integration is connected yet —
      the deployments below are simulated, not live.
    </p>
  );
}

function DeploymentProviderError({ error }: Readonly<{ error?: string | null }>) {
  if (!error) return null;
  return (
    <p className="error-text" style={{ margin: 0 }}>
      {error}
    </p>
  );
}

function DeploymentHistoryBody({
  deployments,
}: Readonly<{ deployments: ProjectDeploymentHistoryItem[] }>) {
  if (!deployments.length) {
    return (
      <p className="env-empty-state">No deployment history tracked yet.</p>
    );
  }

  return (
    <div className="env-metadata-list">
      {deployments.map((deployment) => (
        <DeploymentHistoryRow key={deployment.id} deployment={deployment} />
      ))}
    </div>
  );
}

function DeploymentHistoryRow({
  deployment,
}: Readonly<{ deployment: ProjectDeploymentHistoryItem }>) {
  return (
    <div
      className={`env-metadata-row ${deploymentRowClass(deployment.status)}`}
      style={{ alignItems: "flex-start" }}
    >
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.2rem",
        }}
      >
        <strong>{deployment.targetName}</strong>
        <small>
          {deployment.provider} -{" "}
          {deployment.environment ?? "environment not tracked"} -{" "}
          {deployment.status}
          {pullRequestSuffix(deployment.pullRequestNumber)}
        </small>
        <small>
          Branch {deployment.branch ?? "not available"} - Commit{" "}
          {deployment.commitSha ?? "not available"}
        </small>
        <DeploymentCommitMessage message={deployment.commitMessage} />
        <small>
          Created {formatDate(deployment.createdAt)} - Ready{" "}
          {readyLabel(deployment.readyAt)}
        </small>
        <DeploymentHistoryLinks deployment={deployment} />
      </span>
    </div>
  );
}

function pullRequestSuffix(pullRequestNumber: number | null): string {
  if (pullRequestNumber === null) return "";
  return ` - PR #${pullRequestNumber}`;
}

function readyLabel(readyAt: string | null): string {
  if (readyAt) return formatDate(readyAt);
  return "not ready";
}

function DeploymentCommitMessage({
  message,
}: Readonly<{ message: string | null }>) {
  if (!message) return null;
  return <small>{message}</small>;
}

function DeploymentHistoryLinks({
  deployment,
}: Readonly<{ deployment: ProjectDeploymentHistoryItem }>) {
  return (
    <span className="deployment-history__links">
      <OptionalHrefLink href={deployment.deploymentUrl} label="Open site" />
      <OptionalHrefLink href={deployment.inspectorUrl} label="Build log" />
      <a
        href={deployment.consoleUrl}
        rel="noreferrer noopener"
        target="_blank"
      >
        {providerDisplayName(deployment.provider)} console
      </a>
    </span>
  );
}

function OptionalHrefLink({
  href,
  label,
}: Readonly<{ href: string | null; label: string }>) {
  if (!href) return null;
  return (
    <a href={href} rel="noreferrer noopener" target="_blank">
      {label}
    </a>
  );
}
