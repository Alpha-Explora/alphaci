"use client";

import "./automation.css";
import "./playwright.css";

import { useId, type ReactNode } from "react";

import type { AppRole } from "@/shared/api/contracts";

import { AutomatedBadge } from "../../items";
import {
  mergedNote,
  NO_RUN_TITLE,
  noRunText,
  PROJECT_RUN_BRANCH,
  notRunText,
  playwrightPanelState,
  repositoryHasResults,
  UNSUPPORTED_TEXT,
  type PlaywrightItemRow,
  type PlaywrightRepository,
  type PlaywrightResults,
  type RepositoryRef,
} from "../../model/playwright-tab-rules";
import { repoShortName, resolveProjectRunPermissions } from "../../model/project-run-rules";
import type { ProjectQaRun } from "../../model/project-run-types";
import type { QaAutomationStage } from "../../model/qa-automation-types";
import { REOPEN_TO_RUN_PLAYWRIGHT, UNCONFIRMED_PASS_HINT } from "../../model/qa-automation-rules";
import { shortSha } from "../../model/qa-run-rules";
import type { QaRun } from "../../model/qa-run-types";
import {
  liveRepositories,
  NO_BROWSER_REPOSITORIES_TEXT,
  NO_BROWSER_REPOSITORIES_TITLE,
  visibleStages,
  type RepositoryRoles,
  type StudioColumnRules,
} from "../../model/studio-role-rules";
import { useProjectAutomationViewModel } from "../view-models/use-project-automation-view-model";
import type { ProjectRunViewModel } from "../view-models/use-project-run-view-model";
import { useProjectReopenViewModel } from "../view-models/use-project-signoff-view-model";
import {
  useQaAutomationViewModel,
  type AutomationDispatchControls,
} from "../view-models/use-qa-automation-view-model";
import { usePlaywrightLiveViewModel, type PlaywrightLiveViewModel } from "../view-models/use-playwright-live-view-model";
import {
  useProjectQaExportViewModel,
  useQaExportViewModel,
  type QaExportViewModel,
} from "../view-models/use-qa-export-view-model";
import { useQaReopenViewModel, type QaReopenViewModel } from "../view-models/use-qa-reopen-view-model";
import type { QaRunViewModel } from "../view-models/use-qa-run-view-model";
import { AutomationStages, DispatchFeedback, DispatchReason, RunPlaywrightButton } from "./automation-panel";
import { ExportMenu, ExportStatus } from "./export-menu";
import { LiveAnnouncer, PlaywrightLiveCard } from "./playwright-live";
import { ReopenButton, ReopenDialog } from "./run-signoff";
import { FlaskIcon } from "./studio-icons";

/** Draws a repository's own checks (visual, browser tests): the host page's, not this feature's. */
export type RenderRepositoryChecks = (repository: RepositoryRef) => ReactNode;

/** Where the Playwright tab's run comes from: the Project's QA run, or a repository run. */
export type PlaywrightSource =
  | { kind: "project"; deliveryProjectId: string; vm: ProjectRunViewModel }
  | { kind: "repository"; vm: QaRunViewModel };

function Notice({ title, text, tone }: Readonly<{ title: string; text: string; tone?: "danger" }>) {
  return (
    <div className={`qa-panel-state${tone ? ` qa-panel-state--${tone}` : ""}`} role={tone ? "alert" : undefined}>
      <h3 className="qa-panel-state__title">{title}</h3>
      <p className="qa-panel-state__text">{text}</p>
    </div>
  );
}

/** One repository with no stage reported yet: say so, and how to start it. */
function NotRun({ repository, canStart }: Readonly<{ repository: PlaywrightRepository; canStart: boolean }>) {
  return (
    <div className="qa-auto__empty">
      <span className="qa-auto__empty-icon" aria-hidden="true">
        <FlaskIcon size={18} />
      </span>
      <div>
        <p className="qa-auto__empty-title">{notRunText(repository.branch)}</p>
        <p className="qa-auto__empty-text">
          Results appear here when the verify stage reports for the commit this run covers.
          {canStart ? " Run Playwright to start it now." : ""}
        </p>
      </div>
    </div>
  );
}

/**
 * The live cards for one section: one per repository it covers that has a
 * Playwright run to show. Named only under a merged result, where the section
 * stands for several.
 */
function LiveCards({ repository, live }: Readonly<{ repository: PlaywrightRepository; live: PlaywrightLiveViewModel }>) {
  const named = repository.checks.length > 1;
  return (
    <>
      {repository.checks.map((ref) => {
        const run = live.runs[ref.projectId];
        if (!run) return null;
        // Keyed by run: a new run starts with its own list state (open while it goes).
        const key = `${ref.projectId}:${String(run.runId)}:${String(run.runAttempt)}`;
        return <PlaywrightLiveCard key={key} run={run} name={repoShortName(ref.repoFullName)} labelled={named} />;
      })}
    </>
  );
}

function RepositoryResults({
  repository,
  canStart,
  checks,
  live,
  stages,
}: Readonly<{
  repository: PlaywrightRepository;
  canStart: boolean;
  checks: ReactNode;
  live: PlaywrightLiveViewModel;
  stages: ReadonlyArray<QaAutomationStage>;
}>) {
  const headingId = useId();
  const short = shortSha(repository.commitSha);
  const note = mergedNote(repository.covers);
  return (
    <section className="qa-pw-repo" aria-labelledby={headingId}>
      <div className="qa-pw-repo__head">
        <h4 id={headingId} className="qa-pw-repo__name">
          {repository.name}
        </h4>
        {short ? (
          <code className="qa-pw-repo__sha">
            {repository.branch} @ {short}
          </code>
        ) : null}
      </div>
      {note ? <p className="qa-pw-repo__note">{note}</p> : null}
      <LiveCards repository={repository} live={live} />
      {repositoryHasResults(repository) ? (
        <AutomationStages automation={repository.automation} commitSha={repository.commitSha} stages={stages} />
      ) : (
        <NotRun repository={repository} canStart={canStart} />
      )}
      {checks}
    </section>
  );
}

function ItemRow({ row }: Readonly<{ row: PlaywrightItemRow }>) {
  return (
    <li className="qa-pw-item" data-tone={row.tone}>
      <div className="qa-pw-item__head">
        <span className="qa-pw-item__title">{row.title}</span>
        <AutomatedBadge status={row.status} inferred={row.inferred} />
      </div>
      <p className="qa-pw-item__meta">
        {row.test ? <code>{row.test}</code> : null}
        {row.group ? <span>{row.group}</span> : null}
      </p>
      {row.inferred ? <p className="qa-pw-item__hint">{UNCONFIRMED_PASS_HINT}</p> : null}
      {row.failure ? (
        <p className="qa-pw-item__failure" title={row.failure.message || row.failure.name}>
          {row.failure.message || row.failure.name}
        </p>
      ) : null}
    </li>
  );
}

/** Which requirement each automated test speaks for, failed first. */
function RequirementTests({ items }: Readonly<{ items: PlaywrightItemRow[] }>) {
  const headingId = useId();
  if (items.length === 0) return null;
  return (
    <section className="qa-pw-items" aria-labelledby={headingId}>
      <h4 id={headingId} className="qa-pw-section-title">
        Requirements with automated tests
      </h4>
      <ul className="qa-pw-items__list">
        {items.map((row) => (
          <ItemRow key={row.id} row={row} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Whether to offer "Reopen run" beside Run Playwright: the button is offered
 * but blocked because the run is signed off, and the server lets this viewer
 * reopen it (the same permission as the sign-off banner's Reopen).
 */
function offersReopen(controls: AutomationDispatchControls, reopen: QaReopenViewModel): boolean {
  return controls.canDispatch && controls.blockedReason !== null && reopen.canReopen;
}

/**
 * Run Playwright, and — on a signed-off run, for a viewer who may reopen it —
 * "Reopen run" beside it, through the same confirmation as the Checklist tab.
 * The disabled button is described by why it is disabled.
 */
function DispatchActions({
  controls,
  reopen,
  exporter,
}: Readonly<{ controls: AutomationDispatchControls; reopen: QaReopenViewModel; exporter: QaExportViewModel }>) {
  const reasonId = useId();
  const withReopen = offersReopen(controls, reopen);
  const reason = withReopen ? { ...controls, blockedReason: REOPEN_TO_RUN_PLAYWRIGHT } : controls;
  return (
    <>
      <div className="qa-pw__head">
        <p className="qa-pw__lede">Latest verify stage on the commits this run covers</p>
        <div className="qa-pw__actions">
          <RunPlaywrightButton vm={controls} reasonId={reasonId} />
          {withReopen ? <ReopenButton reopen={reopen} className="qa-pw__reopen" /> : null}
          <ExportMenu vm={exporter} />
        </div>
      </div>
      <DispatchReason vm={reason} id={reasonId} />
      {withReopen ? <ReopenDialog reopen={reopen} /> : null}
    </>
  );
}

/** Who is looking, and whether the tab is showing: what the results and live progress follow. */
export interface PlaywrightViewer {
  rules: StudioColumnRules;
  roles: RepositoryRoles;
  /** The Playwright tab is the one showing: live progress polls only then. */
  active: boolean;
}

/**
 * Live progress for the frontend repositories listed, while the tab shows;
 * a finished run re-reads the QA run so the stage cards catch up.
 */
function useLiveProgress(
  results: PlaywrightResults,
  controls: AutomationDispatchControls,
  viewer: PlaywrightViewer,
): PlaywrightLiveViewModel {
  return usePlaywrightLiveViewModel({
    repositories: liveRepositories(results.repositories, viewer.roles),
    branch: results.repositories[0]?.branch ?? PROJECT_RUN_BRANCH,
    enabled: viewer.active && results.supported,
    startedAt: controls.startedAt,
    onFinished: controls.refresh,
  });
}

/** The results once the run is known: Run Playwright, each repository, then the items. */
function ResultsBody({
  results,
  controls,
  reopen,
  exporter,
  checksFor,
  viewer,
}: Readonly<{
  results: PlaywrightResults;
  controls: AutomationDispatchControls;
  reopen: QaReopenViewModel;
  exporter: QaExportViewModel;
  checksFor: (repository: PlaywrightRepository) => ReactNode;
  viewer: PlaywrightViewer;
}>) {
  const live = useLiveProgress(results, controls, viewer);
  const canStart = controls.canDispatch && !controls.blockedReason;
  // An older server: nothing to show, and no dispatch route to offer either.
  if (!results.supported) return <Notice title="No automated results" text={UNSUPPORTED_TEXT} />;
  // The QA Team on a Project without browser tests: nothing of theirs to run.
  if (viewer.rules.browserOnly && results.repositories.length === 0) {
    return <Notice title={NO_BROWSER_REPOSITORIES_TITLE} text={NO_BROWSER_REPOSITORIES_TEXT} />;
  }
  return (
    <div className="qa-pw">
      <DispatchActions controls={controls} reopen={reopen} exporter={exporter} />
      <DispatchFeedback vm={controls} live={live.confirmation} />
      <ExportStatus vm={exporter} />
      <LiveAnnouncer text={live.announcement} />
      {results.repositories.map((repository) => (
        <RepositoryResults
          key={repository.key}
          repository={repository}
          canStart={canStart}
          checks={checksFor(repository)}
          live={live}
          stages={visibleStages(viewer.rules)}
        />
      ))}
      <RequirementTests items={results.items} />
    </div>
  );
}

interface CommonProps {
  results: PlaywrightResults | null;
  appRole: AppRole | null | undefined;
  /** The repository page this studio is on. */
  projectId: string;
  checksFor: (repository: PlaywrightRepository) => ReactNode;
  viewer: PlaywrightViewer;
}

/** Keyed by run: a new run starts with no dispatch in flight. */
function ProjectResults({
  deliveryProjectId,
  vm,
  run,
  ...common
}: Readonly<CommonProps & { deliveryProjectId: string; vm: ProjectRunViewModel; run: ProjectQaRun }>) {
  const controls = useProjectAutomationViewModel({
    deliveryProjectId,
    run,
    appRole: common.appRole,
    onRun: vm.applyRun,
    projectId: common.projectId,
  });
  // The sign-off banner's permission: the server's flag, else its role rule.
  const permissions = resolveProjectRunPermissions(run, common.appRole);
  const reopen = useProjectReopenViewModel({ deliveryProjectId, run, permissions, onRun: vm.applyRun });
  const exporter = useProjectQaExportViewModel({ deliveryProjectId, runId: run.id });
  if (!common.results) return null;
  return (
    <ResultsBody
      results={common.results}
      controls={controls}
      reopen={reopen}
      exporter={exporter}
      checksFor={common.checksFor}
      viewer={common.viewer}
    />
  );
}

function RepositoryRunResults({ vm, run, ...common }: Readonly<CommonProps & { vm: QaRunViewModel; run: QaRun }>) {
  const controls = useQaAutomationViewModel({
    projectId: common.projectId,
    run,
    appRole: common.appRole,
    onRun: vm.applyRun,
  });
  const reopen = useQaReopenViewModel({ projectId: common.projectId, run, onRun: vm.applyRun });
  const exporter = useQaExportViewModel({ projectId: common.projectId, runId: run.id });
  if (!common.results) return null;
  return (
    <ResultsBody
      results={common.results}
      controls={controls}
      reopen={reopen}
      exporter={exporter}
      checksFor={common.checksFor}
      viewer={common.viewer}
    />
  );
}

function sourceReady(source: PlaywrightSource): boolean {
  return source.vm.status === "ready" || source.vm.status === "idle";
}

function SourceBody({ source, common }: Readonly<{ source: PlaywrightSource; common: CommonProps }>) {
  if (source.kind === "project") {
    const run = source.vm.run;
    if (!run) return null;
    return (
      <ProjectResults key={run.id} deliveryProjectId={source.deliveryProjectId} vm={source.vm} run={run} {...common} />
    );
  }
  const run = source.vm.run;
  if (!run) return null;
  return <RepositoryRunResults key={run.id} vm={source.vm} run={run} {...common} />;
}

/**
 * The studio column's Playwright tab: per repository of the Project (or the
 * one repository), how the latest verify run went on the commit the QA run
 * covers — counts, the pass bar, failures that unfold with their messages —
 * plus "Run Playwright" for QA Team, Team leads and Admins (watched every
 * 20 s for up to 10 minutes), which requirement each automated test speaks
 * for, and the host page's own checks per repository (visual changes, the
 * "Add browser tests" offer) once the tab has been opened.
 *
 * Mounted beside the Checklist tab, never instead of it: the column keeps
 * both, so a dispatch's polling carries on while the tester verifies items.
 */
export function PlaywrightPanel({
  source,
  results,
  appRole,
  projectId,
  opened,
  viewer,
  renderRepositoryChecks,
}: Readonly<{
  source: PlaywrightSource;
  /** Already narrowed to what this viewer sees (`scopePlaywrightResults`). */
  results: PlaywrightResults | null;
  appRole: AppRole | null | undefined;
  projectId: string;
  /** False until the tab is first shown: the host's checks read nothing before. */
  opened: boolean;
  viewer: PlaywrightViewer;
  renderRepositoryChecks?: RenderRepositoryChecks;
}>) {
  if (source.vm.status === "error") {
    return <Notice title="The QA run did not load" text="Its automated results will show once it does." tone="danger" />;
  }
  const state = playwrightPanelState({ ready: sourceReady(source), results });
  if (state === "loading") return <div className="hier-skeleton qa-skeleton-card" aria-hidden="true" />;
  if (state === "no-run") return <Notice title={NO_RUN_TITLE} text={noRunText(source.kind === "project")} />;
  const checksFor = (repository: PlaywrightRepository): ReactNode =>
    opened && renderRepositoryChecks ? (
      <div className="qa-pw-checks">
        {repository.checks.map((ref) => (
          <div key={ref.projectId} className="qa-pw-checks__repo">
            {repository.checks.length > 1 ? <p className="qa-pw-checks__name">{repoShortName(ref.repoFullName)}</p> : null}
            {renderRepositoryChecks(ref)}
          </div>
        ))}
      </div>
    ) : null;
  return <SourceBody source={source} common={{ results, appRole, projectId, checksFor, viewer }} />;
}
