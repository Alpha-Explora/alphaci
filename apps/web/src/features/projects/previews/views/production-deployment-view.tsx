"use client";

import type { DeploymentLogFocus } from "@/features/projects/deployment-logs";
import { previewKey, splitOverviewPreviews } from "../../model/projects-rules";
import { ActiveBranchesList } from "./active-branches-list";
import { BranchPreviewsView, type BranchPreviewsViewProps } from "./branch-previews-view";
import { ProductionDeploymentCard } from "./production-deployment-card";

/** Rows before the rest are left to the Hosting tab, which lists them all. */
const ACTIVE_BRANCH_ROWS = 5;
const BRANCHES_WITH_PRODUCTION = new Set(["main", "uat"]);

export type ProductionDeploymentViewProps = Pick<
  BranchPreviewsViewProps,
  "previews" | "status" | "error"
> & {
  /** The project the previews belong to; a backend card's logs need it. */
  projectId?: string;
  /** Opens the Hosting tab's full logs for a backend card's target. */
  onOpenFullLogs?: (focus: DeploymentLogFocus) => void;
  /**
   * Opens a branch's pull request in the Pull requests tab. Left out for a role
   * without that tab, whose "#N" then reads as plain text.
   */
  onOpenPullRequest?: (pullRequestNumber: number) => void;
};

/**
 * The Overview's deployment summary: the production environment as a card,
 * and active branches underneath. Once a production deploy is live, keep only
 * main and uat in that shorter list; Hosting still has every preview.
 *
 * Anything short of a loaded production environment falls back to the branch
 * list. It already words every "not yet" case - loading, switched off, no
 * provider, no hosting target - and a second copy of those rules here would
 * drift from the first.
 */
export function ProductionDeploymentView({
  previews,
  status,
  error,
  projectId,
  onOpenFullLogs,
  onOpenPullRequest,
}: Readonly<ProductionDeploymentViewProps>) {
  const { production, branches } =
    status === "ready"
      ? splitOverviewPreviews(previews)
      : { production: [], branches: [] };
  const hasLiveProduction = production.some((preview) => preview.status === "ready");
  const visibleBranches = hasLiveProduction
    ? branches.filter((preview) => BRANCHES_WITH_PRODUCTION.has(preview.branch.toLowerCase()))
    : branches;

  if (production.length === 0) {
    return (
      <section aria-labelledby="overview-previews-heading">
        <h4 className="ws-reported__head" id="overview-previews-heading">
          Branch previews
        </h4>
        <BranchPreviewsView
          error={error}
          limit={2}
          moreHref="the Hosting tab"
          previews={previews}
          status={status}
        />
      </section>
    );
  }

  return (
    <section aria-label="Production deployment" className="deploy-cards">
      {production.map((preview) => (
        <ProductionDeploymentCard
          key={previewKey(preview)}
          onOpenFullLogs={onOpenFullLogs}
          preview={preview}
          projectId={projectId}
        />
      ))}
      <ActiveBranchesList
        branches={visibleBranches}
        limit={ACTIVE_BRANCH_ROWS}
        onOpenPullRequest={onOpenPullRequest}
      />
    </section>
  );
}
