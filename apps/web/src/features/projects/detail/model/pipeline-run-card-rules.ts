/**
 * How one commit's pipeline reads on its card in the Pipeline runs tab.
 *
 * Every rule here used to live implicitly in JSX, where it could contradict
 * itself: a PACKAGE pill reading `success` above a count reading "1 running",
 * and a VERIFY pill painted red with nothing next to it to say why. Each
 * function below decides ONE thing the card says, so the card cannot say two
 * different things about the same stage.
 *
 * Pure, so the wording and the precedence are tested rather than eyeballed.
 */

import type { StageId, StageReport } from "@/shared/api/contracts";

import { checkLabel, checkTone, summarizeChecks } from "@/features/runs";

/* ── Stage names ────────────────────────────────────────────────────────── */

const STAGE_NAMES: Record<StageId, string> = {
  access: "Access",
  quality: "Quality",
  package: "Package",
  verify: "Verify",
};

/** What each stage covers, for the muted line under its name. */
const STAGE_COVERAGE: Record<StageId, string> = {
  access: "permissions & branch policy",
  quality: "tests, lint & scans",
  package: "build, deploy & promote",
  verify: "post-deploy browser & API tests",
};

export function stageName(stage: StageId): string {
  return STAGE_NAMES[stage] ?? stage;
}

export function stageCoverage(stage: StageId): string {
  return STAGE_COVERAGE[stage] ?? "";
}

/* ── Check counts ───────────────────────────────────────────────────────── */

/**
 * A stage's checks as a count, a bar and the notes beside them.
 *
 * Skipped checks are out of the denominator. The package stage skips the deploy
 * jobs of the other two branches on every run, so "4 of 9" made a healthy
 * stage look half broken; "4 / 5 passed · 4 skipped" says the same thing and
 * leaves the reader nothing to decode. They are still NAMED, never dropped: a
 * skipped deploy proved nothing, and hiding it would hide that.
 *
 * Null when the stage carries no checks. That is "not known", which must not
 * be drawn as an empty bar.
 */
export interface CheckProgress {
  passed: number;
  /** Checks that ran or are running: the bar's denominator. */
  counted: number;
  failed: number;
  running: number;
  skipped: number;
  /** Passed share of `counted`, 0-100, or null when nothing ran at all. */
  share: number | null;
  /** "4 / 5 passed", or "4 skipped" when nothing ran. */
  label: string;
  /** "1 still running", "4 skipped" — never the failures, which get a toggle. */
  notes: string[];
}

export function checkProgress(
  checks: readonly { conclusion: string }[] | undefined,
): CheckProgress | null {
  const summary = summarizeChecks(checks);
  if (!summary) return null;

  const counted = summary.total - summary.skipped;
  const notes: string[] = [];
  if (summary.running > 0) notes.push(`${summary.running} still running`);
  if (counted > 0 && summary.skipped > 0) {
    notes.push(`${summary.skipped} skipped`);
  }

  return {
    passed: summary.passed,
    counted,
    failed: summary.failed,
    running: summary.running,
    skipped: summary.skipped,
    share: counted > 0 ? Math.round((summary.passed / counted) * 100) : null,
    label:
      counted > 0
        ? `${summary.passed} / ${counted} passed`
        : `${summary.skipped} skipped`,
    notes,
  };
}

/* ── One stage's verdict ────────────────────────────────────────────────── */

export type VerdictTone = "success" | "danger" | "warning" | "running" | "muted";

export type VerdictState =
  | "passed"
  | "passed-with-findings"
  | "finishing"
  | "failed-after-report"
  | "failed"
  | "running"
  | "cancelled"
  | "waiting"
  | "not-run"
  | "did-not-start";

export interface StageVerdict {
  state: VerdictState;
  /** One or two words for the stepper: "Passed", "Did not start". */
  label: string;
  tone: VerdictTone;
  /** A short sentence saying why, when the label alone would leave a question. */
  reason: string | null;
}

/** What GitHub currently says about the run a stage executed in. */
export interface LiveRunState {
  status: string;
  conclusion: string | null;
}

function isFailedConclusion(conclusion: string | null): boolean {
  return conclusion === "failure" || conclusion === "timed_out";
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** The earlier stage whose outcome stopped this one from running. */
function culpritBefore(
  stage: StageReport,
  stages: readonly StageReport[],
): StageReport | undefined {
  const index = stages.findIndex((candidate) => candidate.stage === stage.stage);
  return stages
    .slice(0, Math.max(0, index))
    .find(
      (earlier) =>
        earlier.status === "failure" ||
        earlier.status === "cancelled" ||
        earlier.status === "stalled",
    );
}

function stageBefore(
  stage: StageReport,
  stages: readonly StageReport[],
): StageReport | undefined {
  const index = stages.findIndex((candidate) => candidate.stage === stage.stage);
  return index > 0 ? stages[index - 1] : undefined;
}

function culpritVerb(status: StageReport["status"]): string {
  if (status === "failure") return "failed";
  if (status === "cancelled") return "was cancelled";
  return "did not start";
}

/**
 * A successful stage, reconciled with its checks and with what GitHub says now.
 *
 * Which signal wins, in order:
 *
 *  1. GitHub finished the stage's run as FAILED after the stage reported
 *     success. This is the promotion job: it runs after the stage reports, and
 *     when it fails the report stays green forever. The report is not wrong
 *     about the stage, but "Passed" alone hides a real failure, so the verdict
 *     says both halves.
 *  2. A check was still running when the stage reported, and GitHub has not
 *     finished the run: "Finishing". Once GitHub finishes it green, the running
 *     check finished too and the stage is simply "Passed".
 *  3. A check was still running and there is no live run to ask (it fell off
 *     the page of runs): "Passed", amber, with the caveat said out loud.
 *  4. A check failed, or our grading raised a warning, while the stage still
 *     passed — advisory gates on dev: "Passed with warnings".
 */
function checksNamed(
  stage: StageReport,
  tone: ReturnType<typeof checkTone>,
): string[] {
  return (stage.checks ?? [])
    .filter((check) => checkTone(check.conclusion) === tone)
    .map((check) => checkLabel(check.name));
}

/** Rules 1-3: a check was mid-flight when the stage reported. */
function reconciledVerdict(
  running: readonly string[],
  liveRun: LiveRunState | null,
): StageVerdict | null {
  const names = running.join(", ");
  if (liveRun?.status === "completed" && isFailedConclusion(liveRun.conclusion)) {
    const tail = running.length > 0 ? ` ${names} was still running at report time.` : "";
    return {
      state: "failed-after-report",
      label: "Failed after passing",
      tone: "danger",
      reason: `The stage reported success, then GitHub finished the run as failed.${tail}`,
    };
  }
  if (running.length === 0 || liveRun?.status === "completed") return null;
  if (liveRun) {
    return {
      state: "finishing",
      label: "Finishing",
      tone: "running",
      reason: `The stage passed. ${names} ${plural(running.length, "is", "are")} still running.`,
    };
  }
  return {
    state: "passed-with-findings",
    label: "Passed",
    tone: "warning",
    reason: `${names} ${plural(running.length, "was", "were")} still running when the stage reported, so ${plural(running.length, "its", "their")} result is not known here.`,
  };
}

/** Rule 4: advisory findings inside a passing stage. */
function findingsVerdict(stage: StageReport): StageVerdict | null {
  const failed = checksNamed(stage, "failed");
  if (failed.length > 0) {
    return {
      state: "passed-with-findings",
      label: "Passed with warnings",
      tone: "warning",
      reason: `${failed.join(", ")} failed, but ${plural(failed.length, "it does", "they do")} not block this branch.`,
    };
  }
  const warned = stage.friendlyMessages.find(
    (message) => message.severity === "warning" || message.severity === "error",
  );
  return warned
    ? { state: "passed-with-findings", label: "Passed with warnings", tone: "warning", reason: warned.title }
    : null;
}

const PASSED: StageVerdict = { state: "passed", label: "Passed", tone: "success", reason: null };

function successVerdict(
  stage: StageReport,
  liveRun: LiveRunState | null,
): StageVerdict {
  return (
    reconciledVerdict(checksNamed(stage, "running"), liveRun) ??
    findingsVerdict(stage) ??
    PASSED
  );
}

function blockedVerdict(stage: StageReport, stages: readonly StageReport[]): StageVerdict {
  const culprit = culpritBefore(stage, stages);
  return {
    state: "not-run",
    label: "Not run",
    tone: "muted",
    reason: culprit
      ? `Not run because ${stageName(culprit.stage)} ${culpritVerb(culprit.status)}.`
      : "Not run because an earlier stage did not pass.",
  };
}

function stalledVerdict(stage: StageReport, stages: readonly StageReport[]): StageVerdict {
  const before = stageBefore(stage, stages);
  const name = stageName(stage.stage);
  return {
    state: "did-not-start",
    label: "Did not start",
    tone: "warning",
    reason:
      before?.status === "success"
        ? `${stageName(before.stage)} passed, but ${name} never started.`
        : `${name} never started.`,
  };
}

function waitingVerdict(stage: StageReport, stages: readonly StageReport[]): StageVerdict {
  const before = stageBefore(stage, stages);
  return {
    state: "waiting",
    label: "Waiting",
    tone: "muted",
    reason: before ? `Starts when ${stageName(before.stage)} finishes.` : null,
  };
}

const FIXED_VERDICTS: Partial<Record<StageReport["status"], StageVerdict>> = {
  failure: { state: "failed", label: "Failed", tone: "danger", reason: null },
  running: { state: "running", label: "Running", tone: "running", reason: null },
  cancelled: {
    state: "cancelled",
    label: "Cancelled",
    tone: "muted",
    reason: "The run was cancelled before it finished.",
  },
};

/**
 * What one stage reads as, and why.
 *
 * `stalled` is amber rather than red: nothing failed, the stage simply never
 * started, and painting it the colour of a broken test sent people looking for
 * a test to fix. `blocked` is muted and says which stage it is waiting on — it
 * is a consequence of an earlier failure, not a second one.
 */
export function stageVerdict(
  stage: StageReport,
  stages: readonly StageReport[],
  liveRun: LiveRunState | null = null,
): StageVerdict {
  const fixed = FIXED_VERDICTS[stage.status];
  if (fixed) return fixed;
  if (stage.status === "success") return successVerdict(stage, liveRun);
  if (stage.status === "blocked") return blockedVerdict(stage, stages);
  if (stage.status === "stalled") return stalledVerdict(stage, stages);
  return waitingVerdict(stage, stages);
}

/**
 * The stage whose detail opens without a click: the one the reader came for.
 *
 * Red first, then amber, and nothing at all for a clean pipeline — a passing
 * commit should be one compact card, not four panels of green ticks. A stage
 * that did not run never opens on its own; it is the effect, and opening it
 * would put the effect in front of the cause.
 */
export function defaultOpenStage(
  entries: readonly { stage: { stage: StageId }; verdict: StageVerdict }[],
): StageId | null {
  const danger = entries.find((entry) => entry.verdict.tone === "danger");
  if (danger) return danger.stage.stage;
  const warning = entries.find((entry) => entry.verdict.tone === "warning");
  return warning?.stage.stage ?? null;
}

/* ── The commit's title ─────────────────────────────────────────────────── */

export interface TitledRun {
  event: string;
  displayTitle: string;
  createdAt: string;
}

const BRANCH_PREFIX = /^[^\s·]+ · /;
const BARE_SHA = /^[0-9a-f]{7,40}$/i;

/**
 * The commit's own message, when the runs carry it.
 *
 * A push-triggered run's title IS the commit message: GitHub derives it from
 * the head commit. A chained run's title is inherited ("dev · <message>"), so
 * it is used only when no push run survived, with the branch prefix removed —
 * the section heading already names the branch. A title that is just a sha is
 * the run-name's fallback, not a message, and is no title at all.
 */
export function commitTitle(runs: readonly TitledRun[]): string | null {
  const direct = [...runs]
    .filter((run) => run.event === "push" || run.event === "pull_request")
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))[0];
  const source = direct ?? runs[0];
  if (!source) return null;

  const title = (direct ? source.displayTitle : source.displayTitle.replace(BRANCH_PREFIX, "")).trim();
  if (title === "" || BARE_SHA.test(title)) return null;
  return title;
}

/**
 * Titles that actually tell one commit from another, by commit sha.
 *
 * Every commit on dev read "dev · Release: Promote DEV → UAT (6380118)",
 * because chained runs inherit their title and those were the runs that
 * survived. A title shared by several commits identifies none of them; showing
 * it anyway is the noise the card is trying to remove, so it is dropped and
 * the sha, the author and the time carry the identity instead.
 */
export function distinctCommitTitles(
  commits: readonly { commitSha: string; runs: readonly TitledRun[] }[],
): Map<string, string | null> {
  const titles = commits.map((commit) => [commit.commitSha, commitTitle(commit.runs)] as const);
  const uses = new Map<string, number>();
  for (const [, title] of titles) {
    if (title) uses.set(title, (uses.get(title) ?? 0) + 1);
  }
  return new Map(
    titles.map(([sha, title]) => [sha, title && uses.get(title) === 1 ? title : null]),
  );
}

/* ── Header chip ────────────────────────────────────────────────────────── */

const HEADLINE_LABELS: Record<string, string> = {
  success: "Passed",
  failure: "Failed",
  running: "Running",
  in_progress: "Running",
  cancelled: "Cancelled",
  partial: "Partial",
  attention: "Needs attention",
  timed_out: "Timed out",
  startup_failure: "Rejected",
  skipped: "Skipped",
  queued: "Queued",
  waiting: "Waiting",
  completed: "Completed",
};

/** The commit headline's word, as the chip says it. */
export function headlineChipLabel(label: string): string {
  const known = HEADLINE_LABELS[label];
  if (known) return known;
  const spaced = label.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/* ── Workflow run rows ──────────────────────────────────────────────────── */

export interface LabelledRun {
  id: number;
  name: string;
  displayTitle: string;
  runNumber: number;
}

/**
 * Which workflow a run row is.
 *
 * GitHub's `name` is the run-name when a workflow sets one, so every chained
 * run's name equalled its title and the rows could not be told apart. Our own
 * report knows which stage each run id executed, which names three of them;
 * a push-triggered workflow without a run-name keeps its real name; anything
 * else is at least numbered.
 */
export function workflowRunLabel(
  run: LabelledRun,
  stages: readonly StageReport[],
): string {
  const stage = stages.find((candidate) => candidate.runId === run.id);
  if (stage) return `${stageName(stage.stage)} workflow`;
  if (run.name && run.name !== run.displayTitle) return run.name;
  return `Workflow run #${String(run.runNumber)}`;
}

/** The event that started a run, as a reader says it. */
export function runEventLabel(event: string): string {
  if (event === "workflow_run") return "chained";
  if (event === "workflow_dispatch") return "manual";
  if (event === "pull_request") return "pull request";
  return event.replace(/_/g, " ");
}

/** "2m 10s" for a finished run; null while it is still going or unparseable. */
export function runDuration(run: {
  status: string;
  createdAt: string;
  updatedAt: string;
}): string | null {
  if (run.status !== "completed") return null;
  const ms = Date.parse(run.updatedAt) - Date.parse(run.createdAt);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/* ── A commit's stages, reconciled ──────────────────────────────────────── */

export interface StageEntry {
  stage: StageReport;
  verdict: StageVerdict;
}

/**
 * Every reported stage with its verdict, each checked against the GitHub run
 * it executed in when the run list still carries that run.
 */
export function stageEntries(
  stages: readonly StageReport[],
  runs: readonly ({ id: number } & LiveRunState)[],
): StageEntry[] {
  return stages.map((stage) => {
    const live = runs.find((run) => run.id === stage.runId);
    return {
      stage,
      verdict: stageVerdict(
        stage,
        stages,
        live ? { status: live.status, conclusion: live.conclusion } : null,
      ),
    };
  });
}

/**
 * Whether the verdict's own sentence is worth printing beside the stage's
 * messages.
 *
 * For a stage that failed or never ran, our grading already explains it in its
 * own words ("Waiting on quality: never triggered because quality did not
 * pass"), and a second sentence saying the same thing is the repetition that
 * made the old diagnosis block hard to read. The reconciled states are the
 * opposite: only this client knows that GitHub finished the run after the
 * report, so nothing else on the card will say it.
 */
export function showsVerdictReason(entry: StageEntry): boolean {
  if (!entry.verdict.reason) return false;
  const explained = entry.stage.friendlyMessages.length > 0;
  switch (entry.verdict.state) {
    case "failed":
    case "cancelled":
    case "not-run":
    case "did-not-start":
    case "waiting":
      return !explained;
    case "passed-with-findings":
      // A warning message already names the finding; the check-name sentence
      // is still new information when no message was captured.
      return !explained;
    default:
      return true;
  }
}

/**
 * A GitHub run, job or step status as the card's chip: the same tone set and
 * wording as the stages above it, rather than GitHub's upper-case enum.
 */
export function githubStatusChip(
  status: string,
  conclusion: string | null,
): { tone: VerdictTone; label: string } {
  if (status !== "completed") {
    return {
      tone: status === "queued" || status === "waiting" ? "muted" : "running",
      label: headlineChipLabel(status),
    };
  }
  const tone: VerdictTone =
    conclusion === "success"
      ? "success"
      : conclusion === "failure" || conclusion === "timed_out"
        ? "danger"
        : "muted";
  return { tone, label: headlineChipLabel(conclusion ?? "completed") };
}
