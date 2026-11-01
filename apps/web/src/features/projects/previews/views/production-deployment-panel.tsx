"use client";

import type { DeploymentLogFocus } from "@/features/projects/deployment-logs";
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
  onOpenFullLogs,
  onOpenPullRequest,
}: Readonly<{
  projectId: string;
  /** False while the session is unknown, or when the capability is off. */
  enabled: boolean;
  /** Opens the Hosting tab's full logs for a backend card's target. */
  onOpenFullLogs?: (focus: DeploymentLogFocus) => void;
  /** Opens a branch's pull request in the Pull requests tab, when the role has it. */
  onOpenPullRequest?: (pullRequestNumber: number) => void;
}>) {
  const { previews, status, error } = useBranchPreviewsViewModel({
    projectId,
    enabled,
  });

  return (
    <ProductionDeploymentView
      error={error}
      onOpenFullLogs={onOpenFullLogs}
      onOpenPullRequest={onOpenPullRequest}
      previews={previews}
      projectId={projectId}
      status={status}
    />
  );
}
