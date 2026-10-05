"use client";

import {
  createdLabel,
  displayHost,
  previewKey,
  previewStatusLabel,
  previewStatusTone,
  shortCommitSha,
} from "../../model/projects-rules";
import type { ProjectBranchPreview } from "../../model/projects-types";
import { BranchIcon, CommitIcon, ExternalIcon, PullRequestIcon } from "./deployment-icons";

type RowProps = Readonly<{
  preview: ProjectBranchPreview;
  onOpenPullRequest?: (pullRequestNumber: number) => void;
}>;

function RowCommit({ preview }: RowProps) {
  const sha = shortCommitSha(preview.commitSha);
  if (!sha) {
    return (
      <span className="active-branch__commit active-branch__muted">No commit yet</span>
    );
  }

  return (
    <span className="active-branch__commit">
      <CommitIcon />
      <span className="deploy-card__sha">{sha}</span>
      {preview.commitMessage ? (
        <span className="deploy-card__commit-message">{preview.commitMessage}</span>
      ) : null}
    </span>
  );
}

/**
 * "#47" opens that pull request in the Pull requests tab, not on GitHub. A role
 * without the tab gets no handler, and the number reads as plain text.
 */
function RowPullRequest({ preview, onOpenPullRequest }: RowProps) {
  const number = preview.pullRequestNumber;
  if (number === null) return null;
  if (!onOpenPullRequest) {
    return <span className="active-branch__chip">#{number}</span>;
  }

  return (
    <a
      className="active-branch__chip"
      href="#pulls"
      title={`Open pull request #${number}`}
      onClick={(event) => {
        event.preventDefault();
        onOpenPullRequest(number);
      }}
    >
      <PullRequestIcon />#{number}
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

function ActiveBranchRow({ preview, onOpenPullRequest }: RowProps) {
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
      <RowCommit preview={preview} />
      <RowPullRequest preview={preview} onOpenPullRequest={onOpenPullRequest} />
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
  limit,
  onOpenPullRequest,
}: Readonly<{
  branches: ProjectBranchPreview[];
  limit: number;
  onOpenPullRequest?: (pullRequestNumber: number) => void;
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
            onOpenPullRequest={onOpenPullRequest}
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
