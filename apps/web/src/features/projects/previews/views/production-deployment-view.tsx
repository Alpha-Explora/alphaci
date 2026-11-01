"use client";

import { useId, useState } from "react";

import type { DeploymentLogFocus } from "@/features/projects/deployment-logs";
import { previewKey, splitOverviewPreviews } from "../../model/projects-rules";
import type { ProjectBranchPreview } from "../../model/projects-types";
import { ActiveBranchesList } from "./active-branches-list";
import { BranchPreviewsView, type BranchPreviewsViewProps } from "./branch-previews-view";
import { EnvironmentSwitcher, environmentTabId } from "./environment-switcher";
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
 * One environment at a time: Production and the backend's other
 * environments (uat) as tabs over a single card, so the Overview stays one
 * card tall and only one log tail polls. A project with no such environment
 * keeps its Production card(s) as they were.
 */
function EnvironmentCards({
  cards,
  projectId,
  onOpenFullLogs,
}: Readonly<{
  cards: ProjectBranchPreview[];
  projectId?: string;
  onOpenFullLogs?: (focus: DeploymentLogFocus) => void;
}>) {
  const idPrefix = useId();
  const panelId = `${idPrefix}-panel`;
  const [chosen, setChosen] = useState<string | null>(null);
  const shown = cards.find((preview) => previewKey(preview) === chosen) ?? cards[0];
  if (!shown) return null;
  const shownKey = previewKey(shown);

  return (
    <>
      <EnvironmentSwitcher
        environments={cards}
        idPrefix={idPrefix}
        onSelect={setChosen}
        panelId={panelId}
        selected={shownKey}
      />
      <div aria-labelledby={environmentTabId(idPrefix, shownKey)} id={panelId} role="tabpanel">
        {/* Keyed, so switching environment starts that target's own log tail. */}
        <ProductionDeploymentCard
          key={shownKey}
          onOpenFullLogs={onOpenFullLogs}
          preview={shown}
          projectId={projectId}
        />
      </div>
    </>
  );
}

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
  const { production, environments, branches } =
    status === "ready"
      ? splitOverviewPreviews(previews)
      : { production: [], environments: [], branches: [] };
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
    <section aria-label="Deployments" className="deploy-cards">
      {environments.length > 0 ? (
        <EnvironmentCards
          cards={[...production, ...environments]}
          onOpenFullLogs={onOpenFullLogs}
          projectId={projectId}
        />
      ) : (
        production.map((preview) => (
          <ProductionDeploymentCard
            key={previewKey(preview)}
            onOpenFullLogs={onOpenFullLogs}
            preview={preview}
            projectId={projectId}
          />
        ))
      )}
      <ActiveBranchesList
        branches={visibleBranches}
        limit={ACTIVE_BRANCH_ROWS}
        onOpenPullRequest={onOpenPullRequest}
      />
    </section>
  );
}
