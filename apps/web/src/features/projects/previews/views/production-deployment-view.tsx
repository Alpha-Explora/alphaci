"use client";

import { previewKey, splitOverviewPreviews } from "../../model/projects-rules";
import { ActiveBranchesList } from "./active-branches-list";
import { BranchPreviewsView, type BranchPreviewsViewProps } from "./branch-previews-view";
import { ProductionDeploymentCard } from "./production-deployment-card";

/** Rows before the rest are left to the Hosting tab, which lists them all. */
const ACTIVE_BRANCH_ROWS = 5;

export type ProductionDeploymentViewProps = Pick<
  BranchPreviewsViewProps,
  "previews" | "status" | "error"
> & {
  /** Owner/name on GitHub, for the commit link. */
  repoFullName?: string | null;
};

/**
 * The Overview's deployment summary: the production environment as a card,
 * and every other branch as a one-line row under it, as the provider's own
 * project page lays them out.
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
  repoFullName,
}: Readonly<ProductionDeploymentViewProps>) {
  const { production, branches } =
    status === "ready"
      ? splitOverviewPreviews(previews)
      : { production: [], branches: [] };

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
          preview={preview}
          repoFullName={repoFullName}
        />
      ))}
      <ActiveBranchesList
        branches={branches}
        limit={ACTIVE_BRANCH_ROWS}
        repoFullName={repoFullName}
      />
    </section>
  );
}
