"use client";

import { useMemo, useState } from "react";

import { useBranchPreviewsViewModel } from "@/features/projects/previews";
import { withPreviewCommitMessages } from "../../model/deploy-facts-rules";
import type { ProjectStatus } from "../../model/projects-types";
import type {
  DeploymentTarget,
  EnvVarMetadata,
  ProjectBranchPreview,
  ProjectDeploymentHistoryItem,
  ProjectDeploymentsResponse,
} from "@/shared/api/contracts";
import {
  deploysForEnvironment,
  deriveHostingEnvironments,
  hostingNotice,
  resolvePreviewBranch,
  selectEnvironment,
  targetDeploys,
  type EnvironmentDeploys,
  type HostingEnvironment,
  type HostingEnvironmentKind,
} from "../model/hosting-environment-rules";

export interface HostingTabViewModel {
  /** The branch previews read, which colours the environment switcher. */
  status: ProjectStatus;
  targets: DeploymentTarget[];
  /** The service the tab is showing. */
  target: DeploymentTarget;
  selectTarget: (targetId: string) => void;
  environments: HostingEnvironment[];
  /** The selected environment (Production when the asked one is not offered). */
  environment: HostingEnvironment;
  selectEnvironment: (kind: HostingEnvironmentKind) => void;
  /** Previews: which preview branch's variables to show. */
  previewBranch: string | null;
  selectPreviewBranch: (branch: string) => void;
  /** The previews read's branches, or null while it is unknown. */
  previews: ProjectBranchPreview[] | null;
  /** The one provider notice for the whole tab, or null. */
  notice: string | null;
  /** Read deploy history and branch status again. */
  retry: () => void;
  /** The selected environment's deploys, newest first. */
  deploys: EnvironmentDeploys;
  /** Every deploy of the selected service, for "All deploys". */
  allDeploys: ProjectDeploymentHistoryItem[];
}

/**
 * The Hosting tab's selection: which service, which environment and which
 * preview branch, and what the switcher derives from the reads the page
 * already has (the target, its variables, deploy history and the branch
 * previews). Holds no mutation: the service header and Variables card keep
 * their own view models.
 */
export function useHostingTabViewModel(options: {
  projectId: string;
  /** Never empty: the empty state has no services to select. */
  targets: DeploymentTarget[];
  metadata: EnvVarMetadata[];
  deployments: ProjectDeploymentsResponse | null;
  deploymentsError: string | null;
  reloadDeployments: () => void;
  previewsEnabled: boolean;
  /** The service to open on (the Overview's "Full logs" asked for it). */
  initialTargetId: string | null;
}): HostingTabViewModel {
  const { projectId, targets, metadata, deployments, deploymentsError, reloadDeployments, previewsEnabled } = options;
  const [targetId, setTargetId] = useState<string | null>(options.initialTargetId);
  const [kind, setKind] = useState<HostingEnvironmentKind>("production");
  const [askedPreviewBranch, setAskedPreviewBranch] = useState<string | null>(null);
  const branchPreviews = useBranchPreviewsViewModel({ projectId, enabled: previewsEnabled });

  const target = targets.find((item) => item.id === targetId) ?? targets[0];
  const previews = previewsEnabled ? (branchPreviews.previews?.branches ?? null) : null;
  // Messages the host did not send (a Render image deploy) come from the branch previews' lookup.
  const history = useMemo(
    () => withPreviewCommitMessages(deployments?.deployments ?? [], previews),
    [deployments, previews],
  );
  const siblings = useMemo(() => targets.filter((item) => item.slot === target.slot), [target.slot, targets]);
  const environments = useMemo(
    () => deriveHostingEnvironments({ target, siblings, previews, metadata, deployments: history }),
    [history, metadata, previews, siblings, target],
  );
  const environment = selectEnvironment(environments, kind);

  function retry() {
    reloadDeployments();
    if (previewsEnabled) branchPreviews.reload();
  }

  return {
    status: branchPreviews.status,
    targets,
    target,
    selectTarget: setTargetId,
    environments,
    environment,
    selectEnvironment: setKind,
    previewBranch: resolvePreviewBranch(environment.previewBranches, askedPreviewBranch),
    selectPreviewBranch: setAskedPreviewBranch,
    previews,
    notice: hostingNotice({
      provider: target.provider,
      deployments,
      deploymentsError,
      previews: previewsEnabled ? branchPreviews.previews : null,
      previewsError: previewsEnabled ? branchPreviews.error : null,
    }),
    retry,
    deploys: deploysForEnvironment(history, target.id, environment),
    allDeploys: targetDeploys(history, target.id),
  };
}
