"use client";

import { useBranchPreviewsViewModel } from "../view-models/use-branch-previews-view-model";
import { ProductionDeploymentView } from "./production-deployment-view";

/**
 * Connected Production Deployment summary: owns its ViewModel, like
 * BranchPreviewsPanel, so the Overview can drop it in without knowing how
 * previews load.
 */
export function ProductionDeploymentPanel({
  projectId,
  enabled,
  repoFullName,
}: Readonly<{
  projectId: string;
  /** False while the session is unknown, or when the capability is off. */
  enabled: boolean;
  repoFullName?: string | null;
}>) {
  const { previews, status, error } = useBranchPreviewsViewModel({
    projectId,
    enabled,
  });

  return (
    <ProductionDeploymentView
      error={error}
      previews={previews}
      repoFullName={repoFullName}
      status={status}
    />
  );
}
