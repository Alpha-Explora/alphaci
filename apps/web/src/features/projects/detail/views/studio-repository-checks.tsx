"use client";

import "./workspace/pipeline-runs.css";
import "./workspace/pipeline-visual-checks.css";
import "./studio-repository-checks.css";

import Link from "next/link";

import type { RenderRepositoryChecks, RepositoryRef } from "@/features/checklists/studio";

import { browserTestsCardState, visualCaptureOn, visualOffNotice } from "../model/browser-test-rules";
import type { WorkflowUpdateAccess } from "../model/project-detail-tab-rules";
import { studioVisualSummary, visualNeedsReview } from "../model/visual-check-rules";
import { useBrowserTestsViewModel, type BrowserTestsViewModel } from "../view-models/use-browser-tests-view-model";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { useStudioVisualSummaryViewModel } from "../view-models/use-studio-visual-summary-view-model";
import { BrowserTestsCard } from "./workspace/pipeline-browser-tests-card";

/** The branch QA and PO Studio verify, whose screenshots the line summarises. */
const STUDIO_BRANCH = "uat";

export const REVIEW_VISUAL_LABEL = "Review in Pipeline";

/** For a viewer without the Pipeline tab (QA Team, Product owners). */
export const VISUAL_REVIEW_ELSEWHERE = "Developers and admins review visual changes in Pipeline.";

/**
 * Where "Review in Pipeline" goes: this page's Pipeline tab on Runs, or the
 * other repository's page opened there. In the product, never GitHub.
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
    <Link className="pipe-link studio-checks__link" href={`/projects/${encodeURIComponent(repository.projectId)}#pipeline`}>
      {REVIEW_VISUAL_LABEL}
    </Link>
  );
}

/**
 * The uat line. It waits for the browser-tests status too, because that says
 * whether the workflow takes screenshots at all: "Visual: off for this repo"
 * rather than a "not captured yet" that reads like a pending run. A failed
 * status read (or an older backend) leaves it unknown: today's wording.
 */
function VisualLine({
  repository,
  isCurrent,
  canOpenRuns,
  onOpenRuns,
  browserTests,
}: Readonly<{
  repository: RepositoryRef;
  isCurrent: boolean;
  canOpenRuns: boolean;
  onOpenRuns: () => void;
  browserTests: BrowserTestsViewModel;
}>) {
  const visual = useStudioVisualSummaryViewModel({ projectId: repository.projectId, branch: STUDIO_BRANCH });
  if (visual.status !== "ready" || browserTests.status === "loading") return null;
  const review = visualNeedsReview(visual.checks);
  const captureOn = visualCaptureOn(browserTests.visual, STUDIO_BRANCH);
  return (
    <p className="studio-checks__visual" data-review={review ? "true" : "false"}>
      <span className="studio-checks__summary">{studioVisualSummary(visual.checks, STUDIO_BRANCH, captureOn)}</span>
      {canOpenRuns ? <ReviewLink repository={repository} isCurrent={isCurrent} onOpenRuns={onOpenRuns} /> : null}
      {!canOpenRuns && review ? <span className="studio-checks__note">{VISUAL_REVIEW_ELSEWHERE}</span> : null}
    </p>
  );
}

/**
 * "Add browser tests" — only while the repository lacks them (or a pull
 * request was just opened) — and "Visual testing is off" while the workflow
 * takes no screenshots.
 */
function BrowserTests({
  view,
  onOpenPullRequest,
  workflowAccess,
  onOpenWorkflow,
  workflowHref,
}: Readonly<{
  view: BrowserTestsViewModel;
  onOpenPullRequest?: (pullRequestNumber: number) => void;
  workflowAccess: WorkflowUpdateAccess;
  onOpenWorkflow?: () => void;
  workflowHref?: string;
}>) {
  const state = browserTestsCardState(view.status === "ready" ? view.browserTests : null);
  if (state !== "missing" && !view.added && !visualOffNotice(view.visual)) return null;
  return (
    <BrowserTestsCard
      view={view}
      onOpenPullRequest={onOpenPullRequest}
      workflowAccess={workflowAccess}
      onOpenWorkflow={onOpenWorkflow}
      workflowHref={workflowHref}
    />
  );
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
  workflowAccess = "unavailable",
  onOpenWorkflow,
}: Readonly<{
  repository: RepositoryRef;
  /** The repository whose page this is. */
  isCurrent: boolean;
  /** Whether this viewer has the Pipeline tab at all. */
  canOpenRuns: boolean;
  onOpenRuns: () => void;
  /** Opens this page's Pull requests tab; absent where that is not offered. */
  onOpenPullRequest?: (pullRequestNumber: number) => void;
  /** Whether "Update the workflow" may send this viewer to the update pull request. */
  workflowAccess?: WorkflowUpdateAccess;
  /** Opens this page's Pipeline tab on Configuration; absent where that is not offered. */
  onOpenWorkflow?: () => void;
}>) {
  // One status read for both lines: the browser-tests card and whether uat takes screenshots.
  const browserTests = useBrowserTestsViewModel({ projectId: repository.projectId });
  return (
    <div className="studio-checks">
      <VisualLine
        repository={repository}
        isCurrent={isCurrent}
        canOpenRuns={canOpenRuns}
        onOpenRuns={onOpenRuns}
        browserTests={browserTests}
      />
      <BrowserTests
        view={browserTests}
        onOpenPullRequest={isCurrent ? onOpenPullRequest : undefined}
        workflowAccess={workflowAccess}
        onOpenWorkflow={isCurrent ? onOpenWorkflow : undefined}
        // `#workflow` (the retired Workflow tab) opens Pipeline on Configuration.
        workflowHref={isCurrent ? undefined : `/projects/${encodeURIComponent(repository.projectId)}#workflow`}
      />
    </div>
  );
}

/**
 * What a studio tab hands QA / PO Studio's Playwright tab: this page's checks
 * for any repository of the Project, with the in-app ways this viewer has
 * (Pipeline, Pull requests) and none they do not.
 */
export function studioChecksRenderer(
  currentProjectId: string,
  vm: Pick<ProjectDetailTabsViewModel, "visibleTabs" | "openPipeline" | "openPullRequest" | "workflowUpdateAccess">,
): RenderRepositoryChecks {
  const canOpenRuns = vm.visibleTabs.includes("pipeline");
  const onOpenPullRequest = vm.visibleTabs.includes("pulls") ? vm.openPullRequest : undefined;
  const onOpenWorkflow = () => vm.openPipeline("configuration");
  return function renderChecks(repository) {
    return (
      <StudioRepositoryChecks
        repository={repository}
        isCurrent={repository.projectId === currentProjectId}
        canOpenRuns={canOpenRuns}
        onOpenRuns={() => vm.openPipeline("runs")}
        onOpenPullRequest={onOpenPullRequest}
        workflowAccess={vm.workflowUpdateAccess}
        onOpenWorkflow={onOpenWorkflow}
      />
    );
  };
}
