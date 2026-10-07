"use client";

import "./workspace/pipeline-runs.css";
import "./workspace/pipeline-visual-checks.css";
import "./studio-repository-checks.css";

import Link from "next/link";

import type { RenderRepositoryChecks, RepositoryRef } from "@/features/checklists/studio";

import { browserTestsCardState } from "../model/browser-test-rules";
import { studioVisualSummary, visualNeedsReview } from "../model/visual-check-rules";
import { useBrowserTestsViewModel } from "../view-models/use-browser-tests-view-model";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { useStudioVisualSummaryViewModel } from "../view-models/use-studio-visual-summary-view-model";
import { BrowserTestsCard } from "./workspace/pipeline-browser-tests-card";

/** The branch QA and PO Studio verify, whose screenshots the line summarises. */
const STUDIO_BRANCH = "uat";

export const REVIEW_VISUAL_LABEL = "Review in Pipeline runs";

/** For a viewer without the Pipeline runs tab (QA Team, Product owners). */
export const VISUAL_REVIEW_ELSEWHERE = "Developers and admins review visual changes in Pipeline runs.";

/**
 * Where "Review in Pipeline runs" goes: this page's own tab, or the other
 * repository's page opened on that tab. In the product, never GitHub.
 */
function ReviewLink({
  repository,
  isCurrent,
  onOpenRuns,
}: Readonly<{ repository: RepositoryRef; isCurrent: boolean; onOpenRuns: () => void }>) {
  if (isCurrent) {
    return (
      <button type="button" className="pipe-link studio-checks__link" onClick={onOpenRuns}>
        {REVIEW_VISUAL_LABEL}
      </button>
    );
  }
  return (
    <Link className="pipe-link studio-checks__link" href={`/projects/${encodeURIComponent(repository.projectId)}#runs`}>
      {REVIEW_VISUAL_LABEL}
    </Link>
  );
}

function VisualLine({
  repository,
  isCurrent,
  canOpenRuns,
  onOpenRuns,
}: Readonly<{ repository: RepositoryRef; isCurrent: boolean; canOpenRuns: boolean; onOpenRuns: () => void }>) {
  const visual = useStudioVisualSummaryViewModel({ projectId: repository.projectId, branch: STUDIO_BRANCH });
  if (visual.status !== "ready") return null;
  const review = visualNeedsReview(visual.checks);
  return (
    <p className="studio-checks__visual" data-review={review ? "true" : "false"}>
      <span className="studio-checks__summary">{studioVisualSummary(visual.checks, STUDIO_BRANCH)}</span>
      {canOpenRuns ? <ReviewLink repository={repository} isCurrent={isCurrent} onOpenRuns={onOpenRuns} /> : null}
      {!canOpenRuns && review ? <span className="studio-checks__note">{VISUAL_REVIEW_ELSEWHERE}</span> : null}
    </p>
  );
}

/** "Add browser tests" — only while the repository lacks them (or a pull request was just opened). */
function BrowserTests({
  repository,
  onOpenPullRequest,
}: Readonly<{ repository: RepositoryRef; onOpenPullRequest?: (pullRequestNumber: number) => void }>) {
  const view = useBrowserTestsViewModel({ projectId: repository.projectId });
  const state = browserTestsCardState(view.status === "ready" ? view.browserTests : null);
  if (state !== "missing" && !view.added) return null;
  return <BrowserTestsCard view={view} onOpenPullRequest={onOpenPullRequest} />;
}

/**
 * One repository's own checks under its results in QA / PO Studio's
 * Playwright tab: a one-line visual summary for uat with an in-app way to
 * the Verify stage where screenshots are reviewed and approved, and the
 * "Add browser tests" offer when the repository has none. Read once, when the
 * tab first shows the repository; the studio (checklists feature) only
 * decides where this goes.
 */
export function StudioRepositoryChecks({
  repository,
  isCurrent,
  canOpenRuns,
  onOpenRuns,
  onOpenPullRequest,
}: Readonly<{
  repository: RepositoryRef;
  /** The repository whose page this is. */
  isCurrent: boolean;
  /** Whether this viewer has the Pipeline runs tab at all. */
  canOpenRuns: boolean;
  onOpenRuns: () => void;
  /** Opens this page's Pull requests tab; absent where that is not offered. */
  onOpenPullRequest?: (pullRequestNumber: number) => void;
}>) {
  return (
    <div className="studio-checks">
      <VisualLine repository={repository} isCurrent={isCurrent} canOpenRuns={canOpenRuns} onOpenRuns={onOpenRuns} />
      <BrowserTests repository={repository} onOpenPullRequest={isCurrent ? onOpenPullRequest : undefined} />
    </div>
  );
}

/**
 * What a studio tab hands QA / PO Studio's Playwright tab: this page's checks
 * for any repository of the Project, with the in-app ways this viewer has
 * (Pipeline runs, Pull requests) and none they do not.
 */
export function studioChecksRenderer(
  currentProjectId: string,
  vm: Pick<ProjectDetailTabsViewModel, "visibleTabs" | "setTab" | "openPullRequest">,
): RenderRepositoryChecks {
  const canOpenRuns = vm.visibleTabs.includes("runs");
  const onOpenPullRequest = vm.visibleTabs.includes("pulls") ? vm.openPullRequest : undefined;
  return function renderChecks(repository) {
    return (
      <StudioRepositoryChecks
        repository={repository}
        isCurrent={repository.projectId === currentProjectId}
        canOpenRuns={canOpenRuns}
        onOpenRuns={() => vm.setTab("runs")}
        onOpenPullRequest={onOpenPullRequest}
      />
    );
  };
}
