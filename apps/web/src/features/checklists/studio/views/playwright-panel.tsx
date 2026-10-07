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
  notRunText,
  playwrightPanelState,
  repositoryHasResults,
  UNSUPPORTED_TEXT,
  type PlaywrightItemRow,
  type PlaywrightRepository,
  type PlaywrightResults,
  type RepositoryRef,
} from "../../model/playwright-tab-rules";
import { repoShortName } from "../../model/project-run-rules";
import type { ProjectQaRun } from "../../model/project-run-types";
import { UNCONFIRMED_PASS_HINT } from "../../model/qa-automation-rules";
import { shortSha } from "../../model/qa-run-rules";
import type { QaRun } from "../../model/qa-run-types";
import { useProjectAutomationViewModel } from "../view-models/use-project-automation-view-model";
import type { ProjectRunViewModel } from "../view-models/use-project-run-view-model";
import {
  useQaAutomationViewModel,
  type AutomationDispatchControls,
} from "../view-models/use-qa-automation-view-model";
import type { QaRunViewModel } from "../view-models/use-qa-run-view-model";
import { AutomationStages, DispatchFeedback, DispatchReason, RunPlaywrightButton } from "./automation-panel";
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

function RepositoryResults({
  repository,
  canStart,
  checks,
}: Readonly<{ repository: PlaywrightRepository; canStart: boolean; checks: ReactNode }>) {
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
      {repositoryHasResults(repository) ? (
        <AutomationStages automation={repository.automation} commitSha={repository.commitSha} />
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

/** The results once the run is known: Run Playwright, each repository, then the items. */
function ResultsBody({
  results,
  controls,
  checksFor,
}: Readonly<{
  results: PlaywrightResults;
  controls: AutomationDispatchControls;
  checksFor: (repository: PlaywrightRepository) => ReactNode;
}>) {
  const reasonId = useId();
  const canStart = controls.canDispatch && !controls.blockedReason;
  // An older server: nothing to show, and no dispatch route to offer either.
  if (!results.supported) return <Notice title="No automated results" text={UNSUPPORTED_TEXT} />;
  return (
    <div className="qa-pw">
      <div className="qa-pw__head">
        <p className="qa-pw__lede">Latest verify stage on the commits this run covers</p>
        <RunPlaywrightButton vm={controls} reasonId={reasonId} />
      </div>
      <DispatchReason vm={controls} id={reasonId} />
      <DispatchFeedback vm={controls} />
      {results.repositories.map((repository) => (
        <RepositoryResults
          key={repository.key}
          repository={repository}
          canStart={canStart}
          checks={checksFor(repository)}
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
  if (!common.results) return null;
  return <ResultsBody results={common.results} controls={controls} checksFor={common.checksFor} />;
}

function RepositoryRunResults({ vm, run, ...common }: Readonly<CommonProps & { vm: QaRunViewModel; run: QaRun }>) {
  const controls = useQaAutomationViewModel({
    projectId: common.projectId,
    run,
    appRole: common.appRole,
    onRun: vm.applyRun,
  });
  if (!common.results) return null;
  return <ResultsBody results={common.results} controls={controls} checksFor={common.checksFor} />;
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
  renderRepositoryChecks,
}: Readonly<{
  source: PlaywrightSource;
  results: PlaywrightResults | null;
  appRole: AppRole | null | undefined;
  projectId: string;
  /** False until the tab is first shown: the host's checks read nothing before. */
  opened: boolean;
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
  return <SourceBody source={source} common={{ results, appRole, projectId, checksFor }} />;
}
