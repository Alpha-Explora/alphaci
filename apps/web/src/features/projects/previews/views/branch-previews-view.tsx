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

  if (previews.branches.length === 0) {
    return (
      <p className="env-empty-state">
        No branch has been deployed yet. Push a branch to give it its own
        preview.
      </p>
    );
  }

  const shown =
    typeof limit === "number"
      ? previews.branches.slice(0, limit)
      : previews.branches;
  const hidden = previews.branches.length - shown.length;

  return (
    <div className="branch-previews">
      {shown.map((preview) => (
        <BranchPreviewCard key={previewKey(preview)} preview={preview} />
      ))}
      {hidden > 0 ? (
        <p className="branch-previews__more">
          {hidden} more {hidden === 1 ? "branch" : "branches"}
          {moreHref ? ` in ${moreHref}` : ""}.
        </p>
      ) : null}
    </div>
  );
}
