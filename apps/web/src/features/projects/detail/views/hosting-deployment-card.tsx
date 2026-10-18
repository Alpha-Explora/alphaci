"use client";

import { useState, type ReactNode } from "react";

import type {
  DeploymentTarget,
  ProjectBranchPreview,
  ProjectDeploymentHistoryItem,
  ProjectDeploymentsResponse,
} from "@/shared/api/contracts";
import { deployedAgo, shortCommitSha } from "../../model/projects-rules";
import { deployDurationLabel, deployStatusWord, deployTriggerLabel } from "../../model/deploy-facts-rules";
import {
  deployTone,
  environmentAddress,
  environmentPillLabel,
  environmentStatusWord,
  environmentTone,
  isKnownUndeployed,
  previewForBranch,
  RECENT_DEPLOY_LIMIT,
  undeployedSentence,
  type EnvironmentDeploys,
  type HostingEnvironment,
} from "../model/hosting-environment-rules";
import { providerPublicUrl } from "../model/provider-urls";
import { HostingDot, HostingPill } from "./hosting-status";

type OpenPullRequest = ((pullRequestNumber: number) => void) | undefined;

export interface DeploymentHistoryState {
  /** The deployment history capability is on for this deployment and project. */
  enabled: boolean;
  response: ProjectDeploymentsResponse | null;
}

/**
 * The selected environment's deployment: its status and address (or the
 * preview branches), its recent deploys, and on Production its custom
 * domains.
 */
export function HostingDeploymentCard({
  target,
  environment,
  previews,
  deploys,
  allDeploys,
  history,
  onOpenPullRequest,
  domains,
}: Readonly<{
  target: DeploymentTarget;
  environment: HostingEnvironment;
  previews: ReadonlyArray<ProjectBranchPreview> | null;
  deploys: EnvironmentDeploys;
  allDeploys: ReadonlyArray<ProjectDeploymentHistoryItem>;
  history: DeploymentHistoryState;
  onOpenPullRequest: OpenPullRequest;
  /** Production's custom domains; null elsewhere. */
  domains: ReactNode;
}>) {
  const previewsKnown = previews !== null;
  return (
    <section className="hosting-card hosting-deploy" aria-labelledby="hosting-deploy-heading">
      <div className="hosting-card__head">
        <h4 className="hosting-card__title" id="hosting-deploy-heading">
          Deployment
        </h4>
        <HostingPill tone={environment.tone} label={environmentPillLabel(environment, previewsKnown)} />
      </div>
      {environment.kind === "previews" ? (
        <PreviewBranchList
          branches={environment.previewBranches}
          previews={previews}
          targetId={target.id}
          onOpenPullRequest={onOpenPullRequest}
        />
      ) : (
        <EnvironmentAddress environment={environment} target={target} previewsKnown={previewsKnown} />
      )}
      <RecentDeploys
        environment={environment}
        deploys={deploys}
        allDeploys={allDeploys}
        history={history}
        onOpenPullRequest={onOpenPullRequest}
      />
      {domains}
    </section>
  );
}

function EnvironmentAddress({
  environment,
  target,
  previewsKnown,
}: Readonly<{ environment: HostingEnvironment; target: DeploymentTarget; previewsKnown: boolean }>) {
  const address = environmentAddress(environment, providerPublicUrl(target));
  const undeployed = isKnownUndeployed(environment, previewsKnown);
  return (
    <div className="hosting-address">
      {address ? <AddressLine address={address} live={!undeployed} /> : null}
      {undeployed ? (
        <p className="hosting-quiet">{undeployedSentence(environment.branch ?? "", Boolean(address))}</p>
      ) : null}
    </div>
  );
}

function AddressLine({ address, live }: Readonly<{ address: string; live: boolean }>) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="hosting-address__line">
      <code className="hosting-mono hosting-address__url">{address}</code>
      <button type="button" className="hosting-btn" onClick={() => void copy()}>
        {copied ? "Copied" : "Copy"}
      </button>
      {live ? (
        <a className="hosting-btn hosting-btn--primary" href={address} target="_blank" rel="noreferrer noopener">
          Open site
        </a>
      ) : null}
    </div>
  );
}

function PullRequestChip({
  number,
  onOpenPullRequest,
}: Readonly<{ number: number | null; onOpenPullRequest: OpenPullRequest }>) {
  if (number === null) return null;
  if (!onOpenPullRequest) return <span className="hosting-chip">#{number}</span>;
  return (
    <button
      type="button"
      className="hosting-chip hosting-chip--link"
      title={`Open pull request #${number}`}
      onClick={() => onOpenPullRequest(number)}
    >
      #{number}
    </button>
  );
}

/** Previews: every active preview branch, its pull request and its state. */
function PreviewBranchList({
  branches,
  previews,
  targetId,
  onOpenPullRequest,
}: Readonly<{
  branches: ReadonlyArray<string>;
  previews: ReadonlyArray<ProjectBranchPreview> | null;
  targetId: string;
  onOpenPullRequest: OpenPullRequest;
}>) {
  return (
    <ul className="hosting-rows" aria-label="Preview branches">
      {branches.map((branch) => {
        const preview = previewForBranch(previews, targetId, branch);
        return (
          <li className="hosting-row" key={branch}>
            <code className="hosting-mono hosting-row__main">{branch}</code>
            <span className="hosting-row__status">
              <HostingDot tone={environmentTone(preview)} />
              {environmentStatusWord(preview, previews !== null)}
            </span>
            <PullRequestChip number={preview?.pullRequestNumber ?? null} onOpenPullRequest={onOpenPullRequest} />
            <PreviewOpenLink preview={preview} />
          </li>
        );
      })}
    </ul>
  );
}

function PreviewOpenLink({ preview }: Readonly<{ preview: ProjectBranchPreview | null }>) {
  if (preview?.status !== "ready" || !preview.previewUrl) return null;
  return (
    <a className="hosting-row__link" href={preview.previewUrl} target="_blank" rel="noreferrer noopener">
      Open
    </a>
  );
}

function RecentDeploys({
  environment,
  deploys,
  allDeploys,
  history,
  onOpenPullRequest,
}: Readonly<{
  environment: HostingEnvironment;
  deploys: EnvironmentDeploys;
  allDeploys: ReadonlyArray<ProjectDeploymentHistoryItem>;
  history: DeploymentHistoryState;
  onOpenPullRequest: OpenPullRequest;
}>) {
  const [showAll, setShowAll] = useState(false);
  const recent = deploys.items.slice(0, RECENT_DEPLOY_LIMIT);
  const showBranch = !deploys.byBranch || environment.kind === "previews";
  const notes = <HistoryNotes history={history} />;
  // Nothing to list (an outage, or a branch never deployed): no empty heading.
  // The address line or the header notice already says why.
  if (!recent.length && !allDeploys.length) return notes;
  return (
    <div className="hosting-section">
      {recent.length ? <h5 className="hosting-section__title">Recent deploys</h5> : null}
      {notes}
      <DeployList items={recent} showBranch={showBranch} onOpenPullRequest={onOpenPullRequest} label="Recent deploys" />
      {allDeploys.length > recent.length ? (
        <>
          <button
            type="button"
            className="hosting-disclosure"
            aria-expanded={showAll}
            onClick={() => setShowAll((open) => !open)}
          >
            {showAll ? "Hide all deploys" : `All deploys (${allDeploys.length})`}
          </button>
          {showAll ? (
            <DeployList items={allDeploys} showBranch onOpenPullRequest={onOpenPullRequest} label="All deploys" />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Why there is no history, said once: off, simulated, or not live. Never the provider error. */
function HistoryNotes({ history }: Readonly<{ history: DeploymentHistoryState }>) {
  if (!history.enabled) return <p className="hosting-quiet">Deployment history is not enabled.</p>;
  const response = history.response;
  if (!response) return null;
  if (!response.liveProvidersEnabled) {
    return <p className="hosting-quiet">Live deployment sync is not enabled</p>;
  }
  if (response.mode !== "local_mock") return null;
  return (
    <p className="hosting-quiet">
      Live sync is enabled, but no provider integration is connected yet — the deployments below are simulated, not
      live.
    </p>
  );
}

function DeployList({
  items,
  showBranch,
  onOpenPullRequest,
  label,
}: Readonly<{
  items: ReadonlyArray<ProjectDeploymentHistoryItem>;
  showBranch: boolean;
  onOpenPullRequest: OpenPullRequest;
  label: string;
}>) {
  if (!items.length) return null;
  return (
    <ul className="hosting-rows" aria-label={label}>
      {items.map((deploy) => (
        <DeployRow key={deploy.id} deploy={deploy} showBranch={showBranch} onOpenPullRequest={onOpenPullRequest} />
      ))}
    </ul>
  );
}

function DeployRow({
  deploy,
  showBranch,
  onOpenPullRequest,
}: Readonly<{ deploy: ProjectDeploymentHistoryItem; showBranch: boolean; onOpenPullRequest: OpenPullRequest }>) {
  const sha = shortCommitSha(deploy.commitSha);
  const how = [deployTriggerLabel(deploy.trigger), deployDurationLabel(deploy)].filter(Boolean).join(" · ");
  return (
    <li className="hosting-row">
      <span className="hosting-row__status">
        <HostingDot tone={deployTone(deploy.status)} />
        {deployStatusWord(deploy.status)}
      </span>
      <span className="hosting-row__main">
        {sha ? <code className="hosting-mono">{sha}</code> : null}
        {deploy.commitMessage ? <span className="hosting-row__message">{deploy.commitMessage}</span> : null}
      </span>
      {showBranch && deploy.branch ? <code className="hosting-mono hosting-chip">{deploy.branch}</code> : null}
      <PullRequestChip number={deploy.pullRequestNumber} onOpenPullRequest={onOpenPullRequest} />
      {how ? <span className="hosting-row__how">{how}</span> : null}
      <span className="hosting-row__time">{deployedAgo(deploy.createdAt)}</span>
    </li>
  );
}
