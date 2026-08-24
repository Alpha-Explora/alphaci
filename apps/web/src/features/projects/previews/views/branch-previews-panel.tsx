"use client";

import { useBranchPreviewsViewModel } from "../view-models/use-branch-previews-view-model";
import { BranchPreviewsView } from "./branch-previews-view";

/**
 * Connected panel: owns the ViewModel so a host surface can drop previews in
 * without knowing how they load.
 *
 * Kept separate from BranchPreviewsView so the presentation stays testable
 * without a fetch, which is also what lets the view be rendered from fixtures.
 */
export function BranchPreviewsPanel({
  projectId,
  enabled,
  limit,
  moreHref,
}: Readonly<{
  projectId: string;
  /** False while the session is unknown, or when the capability is off. */
  enabled: boolean;
  limit?: number;
  moreHref?: string;
}>) {
  const { previews, status, error } = useBranchPreviewsViewModel({
    projectId,
    enabled,
  });

  return (
    <BranchPreviewsView
      previews={previews}
      status={status}
      error={error}
      {...(typeof limit === "number" ? { limit } : {})}
      {...(moreHref ? { moreHref } : {})}
    />
  );
}
