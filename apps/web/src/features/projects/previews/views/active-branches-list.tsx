"use client";

import {
  commitUrl,
  createdLabel,
  displayHost,
  previewKey,
  previewStatusLabel,
  previewStatusTone,
  pullRequestUrl,
  shortCommitSha,
} from "../../model/projects-rules";
import type { ProjectBranchPreview } from "../../model/projects-types";
import { BranchIcon, CommitIcon, ExternalIcon, GithubIcon } from "./deployment-icons";

type RowProps = Readonly<{
  preview: ProjectBranchPreview;
  repoFullName?: string | null;
}>;

function RowCommit({ preview, repoFullName }: RowProps) {
  const sha = shortCommitSha(preview.commitSha);
  if (!sha) {
    return (
      <span className="active-branch__commit active-branch__muted">No commit yet</span>
    );
  }
  const href = commitUrl(repoFullName, preview.commitSha);

  return (
    <span className="active-branch__commit">
      <CommitIcon />
      {href ? (
        <a className="deploy-card__sha" href={href} rel="noreferrer noopener" target="_blank">
          {sha}
        </a>
      ) : (
        <span className="deploy-card__sha">{sha}</span>
      )}
      {preview.commitMessage ? (
        <span className="deploy-card__commit-message">{preview.commitMessage}</span>
      ) : null}
    </span>
  );
}

function RowPullRequest({ preview, repoFullName }: RowProps) {
  const href = pullRequestUrl(repoFullName, preview.pullRequestNumber);
  if (!href) return null;

  return (
    <a className="active-branch__chip" href={href} rel="noreferrer noopener" target="_blank">
      <GithubIcon />#{preview.pullRequestNumber}
    </a>
  );
}

/**
 * Opens the branch's own address. Absent while nothing is live there: a
 * build that failed or has not run yet has no page, and a link to one reads
 * as a broken deployment.
 */
function RowVisit({ preview }: RowProps) {
  if (preview.status !== "ready" || !preview.previewUrl) return null;

  return (
    <a
      aria-label={`Visit ${displayHost(preview.previewUrl)}`}
      className="active-branch__visit"
      href={preview.previewUrl}
      rel="noreferrer noopener"
      target="_blank"
      title={`Visit ${displayHost(preview.previewUrl)}`}
    >
      <ExternalIcon />
    </a>
  );
}

function ActiveBranchRow({ preview, repoFullName }: RowProps) {
  const tone = previewStatusTone(preview.status);

  return (
    <li className="active-branch">
      <span className="active-branch__branch">
        <BranchIcon />
        <span className="deploy-card__branch">{preview.branch}</span>
      </span>
      <span className="active-branch__status">
        <span aria-hidden="true" className={`deploy-card__dot deploy-card__dot--${tone}`} />
        {previewStatusLabel(preview.status)}
      </span>
      <RowCommit preview={preview} repoFullName={repoFullName} />
      <RowPullRequest preview={preview} repoFullName={repoFullName} />
      <span className="active-branch__muted active-branch__created">
        {createdLabel(preview)}
      </span>
      <RowVisit preview={preview} />
    </li>
  );
}

/**
 * Every branch but production's, one line each: which branch, whether it is
 * live, and the commit that put it there. The Hosting tab has the full
 * previews; this is the list to scan.
 */
export function ActiveBranchesList({
  branches,
  repoFullName,
  limit,
}: Readonly<{
  branches: ProjectBranchPreview[];
  repoFullName?: string | null;
  limit: number;
}>) {
  if (branches.length === 0) return null;
  const shown = branches.slice(0, limit);
  const hidden = branches.length - shown.length;

  return (
    <section aria-labelledby="active-branches-heading" className="active-branches">
      <h3 className="active-branches__title" id="active-branches-heading">
        Active branches
      </h3>
      <ul className="active-branches__list">
        {shown.map((preview) => (
          <ActiveBranchRow
            key={previewKey(preview)}
            preview={preview}
            repoFullName={repoFullName}
          />
        ))}
      </ul>
      {hidden > 0 ? (
        <p className="branch-previews__more">
          {hidden} more {hidden === 1 ? "branch" : "branches"} on the Hosting tab.
        </p>
      ) : null}
    </section>
  );
}
