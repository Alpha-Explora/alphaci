"use client";

import { previewKey } from "../../model/projects-rules";
import type { ProjectPreviewsResponse } from "../../model/projects-types";
import { BranchPreviewCard } from "./branch-preview-card";

export interface BranchPreviewsViewProps {
  previews: ProjectPreviewsResponse | null;
  status: "loading" | "ready" | "error";
  error: string | null;
  /** Caps how many branches render. Used for the Overview summary placement. */
  limit?: number;
  /** Where the rest of the branches can be found, when `limit` truncates. */
  moreHref?: string;
}

export function BranchPreviewsView({
  previews,
  status,
  error,
  limit,
  moreHref,
}: Readonly<BranchPreviewsViewProps>) {
  const unavailable = previewUnavailableState(previews, status, error);
  if (unavailable) return unavailable;

  const readyPreviews = previews as ProjectPreviewsResponse;
  const shown = typeof limit === "number" ? readyPreviews.branches.slice(0, limit) : readyPreviews.branches;
  const hidden = readyPreviews.branches.length - shown.length;

  return (
    <div className="branch-previews">
      {readyPreviews.providerError ? <p className="branch-previews__error">{readyPreviews.providerError}</p> : null}
      {shown.map((preview) => <BranchPreviewCard key={previewKey(preview)} preview={preview} />)}
      {hidden > 0 ? <MoreBranches hidden={hidden} moreHref={moreHref} /> : null}
    </div>
  );
}

function previewUnavailableState(
  previews: ProjectPreviewsResponse | null,
  status: BranchPreviewsViewProps["status"],
  error: string | null,
) {
  if (status === "error") {
    return <p className="branch-previews__error">{error}</p>;
  }

  if (status === "loading" || !previews) {
    return <p className="env-empty-state">Loading branch previews…</p>;
  }

  if (!previews.enabled) {
    return <p className="env-empty-state">Branch previews are not enabled.</p>;
  }

  if (!previews.liveProvidersEnabled) {
    return (
      <p className="env-empty-state">
        Connect a hosting provider to give each branch its own preview.
      </p>
    );
  }

  // Checked before the empty case: "no branch has been deployed" is a claim
  // about the repository, and it is not one we can make when the provider
  // never answered.
  if (previews.providerError && previews.branches.length === 0) {
    return <p className="branch-previews__error">{previews.providerError}</p>;
  }

  if (previews.branches.length === 0) {
    return (
      <p className="env-empty-state">
        No branch has been deployed yet. Push a branch to give it its own
        preview.
      </p>
    );
  }
  return null;
}

function MoreBranches({ hidden, moreHref }: Readonly<{ hidden: number; moreHref?: string }>) {
  return <p className="branch-previews__more">{hidden} more {hidden === 1 ? "branch" : "branches"}{moreHref ? ` in ${moreHref}` : ""}.</p>;
}
