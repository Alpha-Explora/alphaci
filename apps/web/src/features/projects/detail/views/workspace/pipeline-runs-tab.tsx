"use client";

import "./pipeline-runs.css";

import { useMemo } from "react";

import { WorkspaceEmpty, WorkspaceError, WorkspaceLoading } from "./workspace-states";
import { CommitCard } from "./pipeline-commit-card";
import { distinctCommitTitles } from "../../model/pipeline-run-card-rules";
import { runsViewModeFor, type RunsViewMode } from "../../model/runs-view-mode";
import type { AppRole } from "@/shared/api/contracts";
import type { BranchRunSection } from "../../model/runs-by-branch";
import {
  ALL_BRANCHES,
  usePipelineRunsViewModel,
  type PipelineRunsViewModel,
  type WorkflowRunSummary,
} from "../../view-models/use-pipeline-runs-view-model";
import { useBrowserTestsViewModel } from "../../view-models/use-browser-tests-view-model";
import { visualCaptureOn, type BrowserTestsVisual } from "../../model/browser-test-rules";

/**
 * Live GitHub Actions runs for this project: branch → run → jobs → steps → log.
 *
 * Runs are read PER BRANCH, because that is the unit a pipeline is actually
 * asked about: what is on dev, what reached uat, what shipped. A flat list
 * interleaved all three with nothing but a label to separate them.
 *
 * Every declared branch keeps its section even with no runs. An empty `uat`
 * means nothing has been promoted yet, and that is worth saying out loud — a
 * section that disappears cannot.
 *
 * THE FETCHING RULE: only the run list polls, in its view-model. A run's jobs
 * load when someone expands that run (use-run-jobs-view-model), a job's log
 * when someone opens that job, and a stage's error output when its card is
 * open and the stage actually ran — none of them is ever fetched on the tick. The GitHub rate limit is
 * shared by the entire organisation, so pulling jobs for ten runs every fifteen
 * seconds would drain it and take every other GitHub call in the product down
 * with it.
 *
 * This replaces the old "Runs" tab, which showed only what our own workflow had
 * reported back to us. That record is still the truth about grading; this is the
 * truth about EXECUTION. When a run is green here but never reported, the gap
 * between the two is the diagnosis — which is why the report badge sits on the
 * run row rather than in a separate tab.
 */
export function PipelineRunsTab({
  projectId,
  appRole,
}: {
  projectId: string;
  /**
   * Decides how much is open up front: a developer gets the deep-debug view,
   * every other role the summary with logs behind a disclosure.
   */
  appRole?: AppRole;
}) {
  const viewMode = runsViewModeFor(appRole);
  const runsView = usePipelineRunsViewModel({ projectId });
  // Read once when the tab opens, beside the run list rather than inside its poll:
  // whether the Verify stage takes screenshots, for its visual results. The
  // "Browser tests" setup card lives in QA / PO Studio's Playwright tab, not here.
  const browserTests = useBrowserTestsViewModel({ projectId });

  return (
    <div className="pipeline-tab__run-view">
      <div className="pipeline-tab__head">
        <h2 className="pipeline-tab__name">Workflows</h2>
        {runsView.status === "ready" && !runsView.isEmpty ? (
          <BranchPicker runsView={runsView} />
        ) : null}
      </div>

      <PipelineRunsBody
        projectId={projectId}
        appRole={appRole}
        viewMode={viewMode}
        runsView={runsView}
        visual={browserTests.visual}
      />
    </div>
  );
}

function BranchPicker({ runsView }: Readonly<{ runsView: PipelineRunsViewModel }>) {
  return (
    <label className="ws-branchpick">
      <span className="ws-branchpick__label">Branch</span>
      <select
        className="ws-select"
        value={runsView.selectedBranch}
        onChange={(event) => runsView.selectBranch(event.target.value)}
      >
        {runsView.sections.map((section) => (
          <option key={section.branch} value={section.branch}>
            {section.branch}
            {section.commits.length > 0
              ? ` (${String(section.commits.length)})`
              : " — no runs"}
          </option>
        ))}
        <option value={ALL_BRANCHES}>All branches</option>
      </select>
    </label>
  );
}

function PipelineRunsBody({
  projectId,
  appRole,
  viewMode,
  runsView,
  visual,
}: {
  projectId: string;
  appRole?: AppRole;
  viewMode: RunsViewMode;
  runsView: PipelineRunsViewModel;
  visual: BrowserTestsVisual | null;
}) {
  if (runsView.status === "loading") return <WorkspaceLoading rows={5} />;
  if (runsView.status === "error") {
    return (
      <WorkspaceError
        message={runsView.error ?? "The run list could not be read."}
        onRetry={runsView.reload}
      />
    );
  }
  if (runsView.isEmpty) {
    return (
      <WorkspaceEmpty
        title="No runs yet"
        message="Push a commit to dev and the run will appear here."
      />
    );
  }
  return (
    <div className="ws-panel">
      {runsView.reportsUnavailable && (
        <p className="pipe-banner pipe-banner--warning" role="status">
          Showing what GitHub executed. Our own stage grading could not be read,
          so the per-stage diagnosis is missing from these commits.
        </p>
      )}

      {runsView.visibleSections.map((section) => (
        <BranchSection
          key={section.branch}
          projectId={projectId}
          section={section}
          viewMode={viewMode}
          appRole={appRole}
          repoFullName={runsView.repoFullName}
          visual={visual}
          showBranchHeading={runsView.selectedBranch === ALL_BRANCHES}
        />
      ))}
    </div>
  );
}

/** One branch's history, under a heading that names the branch. */
function BranchSection({
  projectId,
  section,
  viewMode,
  appRole,
  repoFullName,
  visual,
  showBranchHeading,
}: {
  projectId: string;
  repoFullName: string | null;
  section: BranchRunSection<WorkflowRunSummary>;
  viewMode: RunsViewMode;
  appRole?: AppRole;
  /** The workflow's visual setting, from the browser-tests status; null when unknown. */
  visual: BrowserTestsVisual | null;
  showBranchHeading: boolean;
}) {
  // Computed across the section: a title is only worth showing when it tells
  // this commit apart from the others on the branch.
  const titles = useMemo(() => distinctCommitTitles(section.commits), [section.commits]);

  return (
    <section className="ws-runsection" aria-label={`${section.branch} branch`}>
      {showBranchHeading ? (
        <div className="ws-runsection__head">
          <h3 className="ws-runsection__branch">{section.branch}</h3>
          <span className="ws-runsection__count">
            {section.commits.length === 1
              ? "1 commit"
              : `${section.commits.length} commits`}
          </span>
        </div>
      ) : null}

      {section.commits.length === 0 ? (
        <p className="ws-runsection__empty">
          Nothing has run on this branch yet.
        </p>
      ) : (
        <ul className="pipe-commits">
          {section.commits.map((commit) => (
            <CommitCard
              key={commit.commitSha}
              projectId={projectId}
              branch={section.branch}
              commit={commit}
              title={titles.get(commit.commitSha) ?? null}
              viewMode={viewMode}
              appRole={appRole}
              repoFullName={repoFullName}
              visualCaptureOn={visualCaptureOn(visual, section.branch)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
