"use client";

import { previewKey, productionPreviews } from "../../model/projects-rules";
import { BranchPreviewsView, type BranchPreviewsViewProps } from "./branch-previews-view";
import { ProductionDeploymentCard } from "./production-deployment-card";

export type ProductionDeploymentViewProps = Pick<
  BranchPreviewsViewProps,
  "previews" | "status" | "error"
> & {
  /** Owner/name on GitHub, for the commit link. */
  repoFullName?: string | null;
};

/**
 * The Overview's deployment summary: the production environment as a full
 * card, and a count of the rest, which live on the Hosting tab.
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
  const production = status === "ready" ? productionPreviews(previews) : [];

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

  const others = (previews?.branches.length ?? 0) - production.length;

  return (
    <section aria-label="Production deployment" className="deploy-cards">
      {production.map((preview) => (
        <ProductionDeploymentCard
          key={previewKey(preview)}
          preview={preview}
          repoFullName={repoFullName}
        />
      ))}
      {others > 0 ? (
        <p className="branch-previews__more">
          {others} more {others === 1 ? "environment" : "environments"} on the
          Hosting tab.
        </p>
      ) : null}
    </section>
  );
}
