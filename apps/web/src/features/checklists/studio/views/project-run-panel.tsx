"use client";

import "./qa-studio.css";
import "./project-run.css";

import { useId, useState, type ReactNode } from "react";

import type { AppRole } from "@/shared/api/contracts";
import { FilterMenu } from "@/shared/ui/filter-menu";

import {
  IterationNextStepView,
  useNextIterationViewModel,
  type StartIterationViewModel,
} from "../../iteration";
import { deliveredIterationTitle, deliveredRunText, lockedIterationNumber } from "../../model/iteration-rules";
import { kindCopy } from "../../model/requirement-rules";
import {
  canStartProjectRun,
  groupPassLabel,
  headChangeMessage,
  headChangeMessages,
  headLabel,
  isRunLocked,
  PROJECT_CHANGED_SINCE_RUN,
  repositoriesLabel,
  requirementsChangedLabel,
  requirementsChangedNote,
  resolveProjectRunPermissions,
  runFilterEmptyText,
  runFilterLabel,
  STALE_RUN_NOTE,
} from "../../model/project-run-rules";
import type { HeadStatus, ProjectQaRun } from "../../model/project-run-types";
import { agoLabel, shortSha } from "../../model/qa-run-rules";
import { showsRepositories } from "../../model/studio-role-rules";
import {
  useProjectRunListViewModel,
  type ProjectRunListGroup,
  type ProjectRunListViewModel,
} from "../view-models/use-project-run-list-view-model";
import type { ProjectRunViewModel } from "../view-models/use-project-run-view-model";
import {
  useProjectReopenViewModel,
  useProjectSignoffViewModel,
} from "../view-models/use-project-signoff-view-model";
import {
  useProjectVerificationViewModel,
  type ProjectVerificationViewModel,
} from "../view-models/use-project-verification-view-model";
import { useRunEvidenceViewModel, type RunEvidenceViewModel } from "../view-models/use-run-evidence-view-model";
import { useRunTestCasesViewModel, type RunTestCasesViewModel } from "../view-models/use-run-test-cases-view-model";
import { ProjectRunItem } from "./project-run-item";
import { RunSummary, SignoffBanner, SignoffDialog, SignoffFooter } from "./run-signoff";
import { TestCaseEditorDialog } from "./test-case-editor-dialog";

function PanelState({
  title,
  text,
  tone,
  children,
}: Readonly<{ title: string; text: string; tone?: "danger"; children?: ReactNode }>) {
  return (
    <div className={`qa-panel-state${tone ? ` qa-panel-state--${tone}` : ""}`} role={tone ? "alert" : undefined}>
      <h3 className="qa-panel-state__title">{title}</h3>
      <p className="qa-panel-state__text">{text}</p>
      {children}
    </div>
  );
}

function RunSkeleton() {
  return (
    <div className="qa-run-skeleton" aria-hidden="true">
      <span className="hier-skeleton qa-run-skeleton__bar" />
      {[0, 1, 2].map((row) => (
        <span key={row} className="hier-skeleton qa-run-skeleton__row" />
      ))}
    </div>
  );
}

/** Every repository's uat head: now, and (with a run) what the run captured. */
function HeadsList({
  heads,
  withRun,
  shown,
}: Readonly<{ heads: HeadStatus[]; withRun: boolean; shown: boolean }>) {
  if (!shown || heads.length === 0) return null;
  return (
    <ul className="pqa-heads" aria-label="uat heads of this Project's repositories">
      {heads.map((head) => {
        const change = withRun ? headChangeMessage(head) : null;
        return (
          <li key={head.projectId} className="pqa-head" data-changed={change ? "true" : "false"}>
            <span className="pqa-head__name">{headLabel(head.repoFullName, null)}</span>
            <code className="pqa-head__sha">
              uat @ {shortSha(head.currentSha) || "unknown"}
              {withRun && head.runSha && head.runSha !== head.currentSha ? ` (run: ${shortSha(head.runSha)})` : ""}
            </code>
            {change ? <span className="pqa-head__change">{change}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

function StartButton({ vm, label }: Readonly<{ vm: ProjectRunViewModel; label: string }>) {
  const starting = vm.status === "starting";
  return (
    <>
      <button type="button" className="primary-button" disabled={starting} onClick={() => void vm.start()}>
        {starting ? "Starting…" : label}
      </button>
      {vm.startError ? (
        <p className="qa-form-error" role="alert">
          {vm.startError.message}
        </p>
      ) : null}
    </>
  );
}

/** No run on the current heads yet: start one, or say who can. */
/** What changed since a run: each repository, or — for those who see only the Project — one sentence. */
function changeMessages(heads: ReadonlyArray<HeadStatus>, showRepositories: boolean): string[] {
  const messages = headChangeMessages(heads);
  if (showRepositories || messages.length === 0) return messages;
  return [PROJECT_CHANGED_SINCE_RUN];
}

/** No run on the current heads, but an earlier one exists: say what moved since it. */
function MovedSinceLatest({ vm, showRepositories }: Readonly<{ vm: ProjectRunViewModel; showRepositories: boolean }>) {
  const messages = vm.stale ? changeMessages(vm.heads, showRepositories) : [];
  if (messages.length === 0) return null;
  return (
    <div className="pqa-alert pqa-alert--warning" role="status">
      <p className="pqa-alert__title">uat changed since the latest Project run</p>
      <ul className="pqa-alert__list">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

function startRunText(count: number, showRepositories: boolean): string {
  if (!showRepositories) {
    return "A run snapshots every requirement of this Project on its current uat build, so QA verifies them together.";
  }
  return `A run captures the uat head of every repository in this Project${count > 0 ? ` (${repositoriesLabel(count)})` : ""} and snapshots every requirement, so QA verifies them together.`;
}

function StartProjectRun({ vm, appRole }: Readonly<{ vm: ProjectRunViewModel; appRole: AppRole | null | undefined }>) {
  const shown = showsRepositories(appRole);
  if (!canStartProjectRun(appRole)) {
    return (
      <PanelState
        title="QA testing has not started"
        text="QA Team members, Product owners and admins start QA testing. Once it starts, every story and its result appears here."
      >
        <MovedSinceLatest vm={vm} showRepositories={shown} />
        <HeadsList heads={vm.heads} withRun={false} shown={shown} />
      </PanelState>
    );
  }
  return (
    <PanelState title="Verify this Project" text={startRunText(vm.heads.length, shown)}>
      <MovedSinceLatest vm={vm} showRepositories={shown} />
      <HeadsList heads={vm.heads} withRun={false} shown={shown} />
      <StartButton vm={vm} label="Start QA testing" />
    </PanelState>
  );
}

function StaleNotice({
  vm,
  run,
  appRole,
}: Readonly<{ vm: ProjectRunViewModel; run: ProjectQaRun; appRole: AppRole | null | undefined }>) {
  if (!run.stale && !vm.stale) return null;
  // A delivered iteration starts no new run: the server would refuse it.
  const mayStart = canStartProjectRun(appRole) && !isRunLocked(run);
  const messages = changeMessages(vm.heads.length > 0 ? vm.heads : run.repositories, showsRepositories(appRole));
  return (
    <div className="pqa-alert pqa-alert--warning" role="status">
      <p className="pqa-alert__title">This run is stale</p>
      {messages.length > 0 ? (
        <ul className="pqa-alert__list">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      <p className="pqa-alert__text">{STALE_RUN_NOTE}</p>
      {mayStart ? <StartButton vm={vm} label="Start a run on the current heads" /> : null}
    </div>
  );
}

function RequirementsChangedNotice({ run, changed }: Readonly<{ run: ProjectQaRun; changed: boolean }>) {
  if (!changed && !run.requirementsChanged) return null;
  return (
    <div className="pqa-alert pqa-alert--info" role="status">
      <p className="pqa-alert__title">{requirementsChangedLabel(run)}</p>
      <p className="pqa-alert__text">{requirementsChangedNote(run)}</p>
    </div>
  );
}

function RunHead({ run, showRepositories }: Readonly<{ run: ProjectQaRun; showRepositories: boolean }>) {
  const ago = agoLabel(run.createdAt);
  return (
    <p className="qa-run-card__started">
      {run.createdBy ? (
        <>
          Started by <strong>@{run.createdBy.login}</strong>
        </>
      ) : (
        "Started"
      )}
      {ago ? ` · ${ago}` : ""}
      {showRepositories ? ` · ${repositoriesLabel(run.repositories.length)}` : ""} · {run.items.length}{" "}
      {run.items.length === 1 ? "item" : "items"}
    </p>
  );
}

/** What was signed off: each repository at its head, or — for those who see only the Project — the Project. */
function signedSubject(run: ProjectQaRun, showRepositories: boolean): string {
  if (!showRepositories || run.repositories.length === 0) return run.deliveryProjectName;
  return run.repositories.map((head) => headLabel(head.repoFullName, head.runSha)).join(", ");
}

/**
 * What the list shows, as one Filter pill: All, or the items in one
 * Verification, each with its count. "To verify" is the tester's inbox: items
 * leave it as they are recorded, until it is empty.
 */
function RunFilters({ list }: Readonly<{ list: ProjectRunListViewModel }>) {
  if (list.counts.all === 0) return null;
  return (
    <FilterMenu
      ariaLabel="Show items"
      value={list.filter}
      onChange={list.setFilter}
      options={list.filters.map((filter) => ({ id: filter, label: runFilterLabel(filter), count: list.counts[filter] }))}
    />
  );
}

function RunToolbar({
  checklistMode,
  summaryShown,
  run,
  list,
  shown,
  canEditTestCases,
  onCreateTestCases,
}: Readonly<{
  checklistMode: boolean;
  summaryShown: boolean;
  run: ProjectQaRun;
  list: ProjectRunListViewModel;
  shown: boolean;
  canEditTestCases: boolean;
  onCreateTestCases: () => void;
}>) {
  return (
    <div className="pqa-run__toolbar">
      {checklistMode && summaryShown ? (
        <RunSummary run={run} variant="compact">
          <RunHead run={run} showRepositories={shown} />
        </RunSummary>
      ) : null}
      <RunFilters list={list} />
      {!checklistMode && canEditTestCases ? (
        <button type="button" className="ghost-button pqa-run__edit-test-cases" onClick={onCreateTestCases}>
          <span aria-hidden="true">+</span>
          Create test cases
        </button>
      ) : null}
    </div>
  );
}

function RunStartSummary({
  run,
  shown,
  summaryShown,
  checklistMode,
}: Readonly<{ run: ProjectQaRun; shown: boolean; summaryShown: boolean; checklistMode: boolean }>) {
  if (!summaryShown) return <RunHead run={run} showRepositories={shown} />;
  if (checklistMode) return null;
  return (
    <RunSummary run={run}>
      <RunHead run={run} showRepositories={shown} />
    </RunSummary>
  );
}

function RunTestCaseEditorSlot({
  checklistMode,
  open,
  onClose,
  run,
  vm,
  testCases,
}: Readonly<{
  checklistMode: boolean;
  open: boolean;
  onClose: () => void;
  run: ProjectQaRun;
  vm: ProjectRunViewModel;
  testCases: RunTestCasesViewModel;
}>) {
  if (checklistMode) return null;
  return (
    <TestCaseEditorDialog
      items={run.items}
      vm={testCases}
      open={open}
      onClose={onClose}
      onReload={vm.reload}
    />
  );
}

/**
 * One requirement's items. Under "All" its heading folds it away (a fully
 * passed requirement starts folded); under a filter it always shows what
 * matched, so the heading is plain.
 */
function RunGroup({
  group,
  list,
  editor,
  evidence,
  testCases,
  checklistMode,
  onReload,
}: Readonly<{
  group: ProjectRunListGroup;
  list: ProjectRunListViewModel;
  editor: ProjectVerificationViewModel;
  evidence: RunEvidenceViewModel;
  testCases: RunTestCasesViewModel;
  checklistMode: boolean;
  onReload: () => void;
}>) {
  const listId = useId();
  const name = (
    <>
      <span className="pqa-kind" data-kind={group.kind}>
        {kindCopy(group.kind).singular}
      </span>
      <span className="pqa-group__name">{group.requirementName}</span>
    </>
  );
  return (
    <section className="pqa-group" aria-label={`${kindCopy(group.kind).singular}: ${group.requirementName}`}>
      <div className="pqa-group__head">
        <h4 className="pqa-group__title">
          {list.filter === "all" ? (
            <button
              type="button"
              className="pqa-group__toggle"
              aria-expanded={group.expanded}
              aria-controls={listId}
              onClick={() => list.toggleGroup(group.key)}
            >
              {name}
            </button>
          ) : (
            name
          )}
        </h4>
        <span className="pqa-group__progress">{groupPassLabel(group)}</span>
      </div>
      {group.expanded ? (
        <ol className="qa-run__items" id={listId}>
          {group.shown.map((item) => (
            <ProjectRunItem
              key={item.id}
              item={item}
              index={group.offset + group.items.indexOf(item)}
              editor={editor}
              evidence={evidence}
              testCases={testCases}
              showEvidence={!checklistMode}
              canEditTestCases={checklistMode}
              onReload={onReload}
            />
          ))}
        </ol>
      ) : null}
    </section>
  );
}

/** A run and everything that can be done to it. Mounted (and keyed) once a run exists. */
function RunBody({
  deliveryProjectId,
  vm,
  run,
  appRole,
  next,
  summaryShown,
  checklistMode,
}: Readonly<{
  deliveryProjectId: string;
  vm: ProjectRunViewModel;
  run: ProjectQaRun;
  appRole: AppRole | null | undefined;
  /** After a delivered iteration: the waiting sentence, or Start iteration N+1. */
  next: StartIterationViewModel;
  summaryShown: boolean;
  checklistMode: boolean;
}>) {
  const [testCaseEditorOpen, setTestCaseEditorOpen] = useState(false);
  const permissions = resolveProjectRunPermissions(run, appRole);
  const editor = useProjectVerificationViewModel({
    deliveryProjectId,
    run,
    permissions,
    onRun: vm.applyRun,
    onReload: vm.reload,
  });
  const signoff = useProjectSignoffViewModel({ deliveryProjectId, run, permissions, onRun: vm.applyRun });
  const reopen = useProjectReopenViewModel({ deliveryProjectId, run, permissions, onRun: vm.applyRun });
  const list = useProjectRunListViewModel(run);
  const evidence = useRunEvidenceViewModel({ deliveryProjectId, run });
  const testCases = useRunTestCasesViewModel({
    deliveryProjectId,
    run,
    permissions,
    onRun: vm.applyRun,
    onReload: vm.reload,
  });
  const lockedNumber = lockedIterationNumber(run.iteration);
  const shown = showsRepositories(appRole);

  return (
    <div className="qa-run pqa-run__body">
      <IterationNextStepView vm={next} />
      <RunStartSummary run={run} shown={shown} summaryShown={summaryShown} checklistMode={checklistMode} />
      <StaleNotice vm={vm} run={run} appRole={appRole} />
      <RequirementsChangedNotice run={run} changed={vm.requirementsChanged} />
      <SignoffBanner run={run} subject={signedSubject(run, shown)} reopen={reopen} />
      <HeadsList heads={vm.heads.length > 0 ? vm.heads : run.repositories} withRun shown={shown} />
      {/* Who started the run sits in its progress box, under the count. */}
      <RunToolbar
        checklistMode={checklistMode}
        summaryShown={summaryShown}
        run={run}
        list={list}
        shown={shown}
        canEditTestCases={run.items.some((item) => testCases.canManage(item))}
        onCreateTestCases={() => setTestCaseEditorOpen(true)}
      />
      {list.status === "empty" ? <p className="pqa-note">{runFilterEmptyText(list.filter)}</p> : null}
      {list.groups.map((group) => (
        <RunGroup
          key={group.key}
          group={group}
          list={list}
          editor={editor}
          evidence={evidence}
          testCases={testCases}
          checklistMode={checklistMode}
          onReload={vm.reload}
        />
      ))}
      <RunTestCaseEditorSlot
        checklistMode={checklistMode}
        open={testCaseEditorOpen}
        onClose={() => setTestCaseEditorOpen(false)}
        run={run}
        vm={vm}
        testCases={testCases}
      />
      {run.status === "open" && lockedNumber === null ? <SignoffFooter vm={signoff} /> : null}
      {signoff.canSignOff ? (
        <SignoffDialog
          vm={signoff}
          description={shown ? `${run.deliveryProjectName} on ${signedSubject(run, shown)}` : run.deliveryProjectName}
        />
      ) : null}
    </div>
  );
}

/**
 * A delivered iteration's run has left this tab: it is archived, read-only as
 * QA signed it off, in History. What is left is the next step — Start
 * iteration N+1, or the waiting sentence — and the way to History where the
 * page has one.
 */
function DeliveredRun({
  number,
  next,
  onOpenHistory,
}: Readonly<{ number: number; next: StartIterationViewModel; onOpenHistory?: () => void }>) {
  return (
    <div className="pqa-delivered-state">
      <div className="pqa-delivered" role="status">
        <p className="pqa-delivered__title">{deliveredIterationTitle(number)}</p>
        <p className="pqa-delivered__text">{deliveredRunText(Boolean(onOpenHistory))}</p>
        {onOpenHistory ? (
          <button type="button" className="ghost-button" onClick={onOpenHistory}>
            View in Release
          </button>
        ) : null}
      </div>
      <IterationNextStepView vm={next} />
    </div>
  );
}

/**
 * No run on the current heads. Once the iteration is delivered and none is
 * active, no run can start: the waiting sentence (or, for a Product owner or
 * admin, Start iteration N+1) takes the Start button's place.
 */
function NoRun({
  vm,
  appRole,
  next,
}: Readonly<{ vm: ProjectRunViewModel; appRole: AppRole | null | undefined; next: StartIterationViewModel }>) {
  if (next.step.kind === "none") return <StartProjectRun vm={vm} appRole={appRole} />;
  return (
    <div className="pqa-next">
      <IterationNextStepView vm={next} />
    </div>
  );
}

/**
 * A Project's QA run: every repository's uat head, the run that covers them,
 * and — for the QA Team, Product owners and admins — Verification and
 * sign-off. Developers see the same run read-only. `fallback` renders when
 * the server has no Project runs yet (an older backend). Between a delivered
 * iteration and the next, it says who the team is waiting for.
 */
export function ProjectRunPanel({
  deliveryProjectId,
  vm,
  appRole,
  fallback,
  onOpenHistory,
  summaryShown,
  checklistMode = false,
}: Readonly<{
  deliveryProjectId: string;
  vm: ProjectRunViewModel;
  appRole: AppRole | null | undefined;
  fallback?: ReactNode;
  /** Opens the page's History tab, where a delivered iteration's run is kept. */
  onOpenHistory?: () => void;
  /** False where the host shows the run's progress itself (QA Studio's column heading). */
  summaryShown?: boolean;
  /** Checklist tab: compact summary, no evidence, and direct test-case authoring. */
  checklistMode?: boolean;
}>) {
  const next = useNextIterationViewModel({ deliveryProjectId, enabled: true, appRole });
  const body = projectRunBody({
    deliveryProjectId,
    vm,
    appRole,
    fallback,
    onOpenHistory,
    summaryShown,
    checklistMode,
    next,
  });
  return <div className="pqa-run">{body}</div>;
}

function projectRunBody({
  deliveryProjectId,
  vm,
  appRole,
  fallback,
  onOpenHistory,
  summaryShown,
  checklistMode,
  next,
}: Readonly<{
  deliveryProjectId: string;
  vm: ProjectRunViewModel;
  appRole: AppRole | null | undefined;
  fallback?: ReactNode;
  onOpenHistory?: () => void;
  summaryShown?: boolean;
  checklistMode: boolean;
  next: StartIterationViewModel;
}>) {
  const deliveredNumber = vm.run ? lockedIterationNumber(vm.run.iteration) : null;
  let body: ReactNode;
  if (vm.status === "idle" || vm.status === "loading") body = <RunSkeleton />;
  else if (vm.status === "unavailable") {
    body = fallback ?? (
      <PanelState title="QA testing is not available" text="This server does not offer Project QA testing yet." />
    );
  } else if (vm.status === "error") {
    body = (
      <PanelState title="QA testing did not load" text={vm.error ?? ""} tone="danger">
        <button type="button" className="ghost-button" onClick={vm.reload}>
          Try again
        </button>
      </PanelState>
    );
  } else if (!vm.run) body = <NoRun vm={vm} appRole={appRole} next={next} />;
  else if (deliveredNumber !== null) {
    body = <DeliveredRun number={deliveredNumber} next={next} onOpenHistory={onOpenHistory} />;
  } else {
    // Keyed by run: a reopened or newly started run gets fresh drafts and dialogs.
    body = (
      <RunBody
        key={vm.run.id}
        deliveryProjectId={deliveryProjectId}
        vm={vm}
        run={vm.run}
        appRole={appRole}
        next={next}
        summaryShown={summaryShown !== false}
        checklistMode={checklistMode}
      />
    );
  }
  return body;
}
