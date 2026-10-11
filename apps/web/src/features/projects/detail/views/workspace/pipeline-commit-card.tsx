"use client";

import { useId, useMemo, useState } from "react";

import { CiRunReportExport } from "@/features/checklists/studio";
import { checkLabel, relativeTime } from "@/features/runs";
import type { AppRole, RunGroup, StageId } from "@/shared/api/contracts";

import type { RunsViewMode } from "../../model/runs-view-mode";
import {
  defaultOpenStage,
  headlineChipLabel,
  stageEntries,
  stageName,
  type VerdictTone,
} from "../../model/pipeline-run-card-rules";
import {
  promotionReadiness,
  type PromotionReadiness,
} from "../../model/promotion-readiness";
import { commitHeadline, type CommitHeadline, type CommitRunGroup } from "../../model/runs-by-commit";
import { isVisualBranch, visualChipLabel, visualRequestRunId } from "../../model/visual-check-rules";
import type { WorkflowRunSummary } from "../../view-models/use-pipeline-runs-view-model";
import { useVisualChecksViewModel } from "../../view-models/use-visual-checks-view-model";
import { ChevronIcon, InfoIcon, PromoteIcon } from "./pipeline-glyphs";
import { StageDetail, StageStepper, StatusChip } from "./pipeline-stage-detail";
import { WorkflowRunList } from "./pipeline-workflow-runs";

const HEADLINE_TONE: Record<CommitHeadline["tone"], VerdictTone> = {
  success: "success",
  failure: "danger",
  running: "running",
  neutral: "muted",
  warning: "warning",
};

/**
 * One commit, and what its pipeline did, as one card.
 *
 * Read top to bottom it answers the three questions in the order they are
 * asked: did it pass (the chip, from our REPORT, never the newest GitHub run —
 * that put SUCCESS above a failed quality stage), how far did it get (the
 * stepper), and why did it stop (the failing stage's card, open without a
 * click, with the error output inside it).
 *
 * The GitHub runs are behind the footer toggle: a commit produces one per
 * chained workflow, and that list is detail, not headline. Expanding it loads
 * nothing; a run's jobs load only when that run is opened.
 *
 * On uat and main the Verify stage also holds the commit's visual checks. They
 * are read the first time that stage is open — never for every card on the
 * tab — and kept here, so the stepper can say "Visual: 2 changed" after the
 * stage is closed again.
 */
export function CommitCard({
  projectId,
  branch,
  commit,
  title,
  viewMode = "deep",
  appRole,
  repoFullName,
  visualCaptureOn = null,
}: Readonly<{
  projectId: string;
  /** `owner/repo`, for the file names of downloaded screenshots. */
  repoFullName?: string | null;
  /**
   * False when the repository's workflow takes no screenshots on this branch
   * (from the browser-tests status); null when unknown or an older backend.
   */
  visualCaptureOn?: boolean | null;
  branch: string;
  commit: CommitRunGroup<WorkflowRunSummary>;
  title: string | null;
  viewMode?: RunsViewMode;
  /** Decides whether visual changes can be approved from this card. */
  appRole?: AppRole;
}>) {
  const headingId = useId();
  const panelId = useId();
  const { report } = commit;
  const headline = commitHeadline(commit);
  const tone = HEADLINE_TONE[headline.tone];

  const entries = useMemo(
    () => (report ? stageEntries(report.stages, commit.runs) : []),
    [report, commit.runs],
  );

  /*
   * `undefined` until someone clicks a step: until then the open stage follows
   * the data, so a commit that turns red while the tab is open opens on its
   * failure without a reload. Once chosen, the reader's choice sticks.
   */
  const [chosen, setChosen] = useState<StageId | null | undefined>(undefined);
  const openStage = chosen === undefined ? defaultOpenStage(entries) : chosen;
  const openEntry = entries.find((entry) => entry.stage.stage === openStage);
  const verifyEntry = entries.find((entry) => entry.stage.stage === "verify");

  const visual = useVisualChecksViewModel({
    projectId,
    branch,
    runId: visualRequestRunId(verifyEntry?.stage.runId),
    enabled: openStage === "verify",
    appRole,
    repoFullName,
  });
  const visualChip = visualChipLabel(visual.checks, visualCaptureOn);
  const showsVisual = openEntry?.stage.stage === "verify" && isVisualBranch(branch);

  return (
    <li className="pipe-commit-item">
      <article className={`pipe-commit pipe-commit--${tone}`} aria-labelledby={headingId} data-commit-card>
        <CommitHeader
          headingId={headingId}
          title={title}
          commit={commit}
          tone={tone}
          label={headlineChipLabel(headline.label)}
        />

        {report ? (
          <>
            <StageStepper
              entries={entries}
              openStage={openStage}
              panelId={panelId}
              onSelect={(stage) => setChosen(openStage === stage ? null : stage)}
              visualChip={visualChip}
            />
            <PromotionBanner branch={branch} report={report} runs={commit.runs} />
          </>
        ) : (
          <p className="pipe-banner pipe-banner--muted">
            <InfoIcon />
            <span>
              No stage report was filed for this commit. The runs below are what GitHub executed.
            </span>
          </p>
        )}

        {openEntry && (
          <StageDetail
            key={openEntry.stage.stage}
            projectId={projectId}
            entry={openEntry}
            panelId={panelId}
            viewMode={viewMode}
            branch={branch}
            visual={showsVisual ? visual : undefined}
            visualChip={visualChip}
            visualCaptureOn={visualCaptureOn}
          />
        )}

        <CommitRuns projectId={projectId} branch={branch} commit={commit} />
      </article>
    </li>
  );
}

/** The commit's identity: its message when one tells it apart, sha, author, time. */
function CommitHeader({
  headingId,
  title,
  commit,
  tone,
  label,
}: Readonly<{
  headingId: string;
  title: string | null;
  commit: CommitRunGroup<WorkflowRunSummary>;
  tone: VerdictTone;
  label: string;
}>) {
  const { latest } = commit;
  const shortSha = commit.commitSha.slice(0, 7);
  return (
    <header className="pipe-commit__head">
      <div className="pipe-commit__identity">
        <h4 id={headingId} className="pipe-commit__title">
          {title ?? (
            <>
              Commit <code className="pipe-sha pipe-sha--title">{shortSha}</code>
            </>
          )}
        </h4>
        <p className="pipe-commit__meta">
          {title && <code className="pipe-sha">{shortSha}</code>}
          {latest.actor && <span>{latest.actor}</span>}
          {latest.createdAt && (
            <time dateTime={latest.createdAt} title={new Date(latest.createdAt).toLocaleString()}>
              {relativeTime(latest.createdAt)}
            </time>
          )}
        </p>
      </div>
      <div className="pipe-commit__actions">
        {commit.report ? (
          <CiRunReportExport
            run={{
              repoFullName: commit.report.repoFullName,
              branch: commit.report.branch,
              commitSha: commit.report.commitSha,
            }}
          />
        ) : null}
        <StatusChip tone={tone} label={label} />
      </div>
    </header>
  );
}

/**
 * The GitHub runs behind the footer toggle. Opening the list fetches nothing;
 * a run's jobs load only when that run is opened. With no report the runs are
 * all there is, so they start open.
 */
function CommitRuns({
  projectId,
  branch,
  commit,
}: Readonly<{
  projectId: string;
  branch: string;
  commit: CommitRunGroup<WorkflowRunSummary>;
}>) {
  const runsId = useId();
  /*
   * Derived until someone clicks, like the open stage: the report arrives a
   * moment after the runs, and seeding state from that first render left every
   * graded commit with its run list open.
   */
  const [chosen, setChosen] = useState<boolean | undefined>(undefined);
  const open = chosen ?? commit.report === null;
  const count = commit.runs.length;

  return (
    <>
      <footer className="pipe-commit__foot">
        <button
          type="button"
          className="pipe-foot-toggle"
          data-runs-toggle
          aria-expanded={open}
          aria-controls={open ? runsId : undefined}
          onClick={() => setChosen(!open)}
        >
          <ChevronIcon />
          {count === 1 ? "1 workflow run" : `${count} workflow runs`}
        </button>
      </footer>

      {open && (
        <WorkflowRunList
          id={runsId}
          projectId={projectId}
          branch={branch}
          runs={commit.runs}
          stages={commit.report?.stages ?? []}
        />
      )}
    </>
  );
}

const PROMOTION_TONE: Record<PromotionReadiness["state"], VerdictTone> = {
  opened: "success",
  "in-progress": "running",
  failed: "danger",
  blocked: "danger",
  "did-not-run": "muted",
  "not-applicable": "muted",
};

/**
 * Whether this commit opened its promotion pull request, as one line with an
 * icon rather than loose italic text.
 *
 * The promotion job SKIPS when its requirements are unmet, the quietest
 * outcome there is, so a promotion that did not happen looks exactly like one
 * nobody wanted unless this says so. Nothing at all for a branch that does not
 * promote, or a stage that reported no checks: "not known" must not read as
 * "did not promote".
 */
function PromotionBanner({
  branch,
  report,
  runs,
}: Readonly<{ branch: string; report: RunGroup; runs: readonly WorkflowRunSummary[] }>) {
  const packageStage = report.stages.find((stage) => stage.stage === "package");
  const packageRun = packageStage ? runs.find((run) => run.id === packageStage.runId) : undefined;
  const readiness = promotionReadiness(
    branch,
    packageStage?.checks,
    packageRun ? { status: packageRun.status, conclusion: packageRun.conclusion } : null,
  );
  if (readiness.state === "not-applicable") return null;

  const target = readiness.target ?? "";
  const stage = stageName("package");
  const text: Record<Exclude<PromotionReadiness["state"], "not-applicable">, string> = {
    opened: `Promotion pull request into ${target} is open.`,
    "in-progress": `The promotion into ${target} was still running when ${stage} reported.`,
    failed: `The promotion into ${target} failed after ${stage} reported, so no pull request was opened.`,
    blocked: `Not promoted to ${target}: ${readiness.blockedBy.map(checkLabel).join(", ")} failed.`,
    "did-not-run": `No promotion pull request into ${target} was opened for this commit.`,
  };

  return (
    <p className={`pipe-banner pipe-banner--${PROMOTION_TONE[readiness.state]}`}>
      <PromoteIcon />
      <span>{text[readiness.state]}</span>
    </p>
  );
}
