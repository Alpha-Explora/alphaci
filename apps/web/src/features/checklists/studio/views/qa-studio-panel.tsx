"use client";

import "./qa-studio.css";

import { useId, type ReactNode, type Ref } from "react";

import type { AppRole } from "@/shared/api/contracts";

import { itemCountLabel } from "../../model/checklist-rules";
import { QA_ERROR_MESSAGES } from "../../model/qa-error-messages";
import { UNFILED_REASON } from "../../model/qa-promotion-rules";
import { passedLabel } from "../../model/qa-run-rules";
import type { QaRun } from "../../model/qa-run-types";
import { REPOSITORY_SCOPE, type QaScope } from "../../model/qa-scope";
import { automationSignal, launcherLabel, NO_QA_ENVIRONMENT } from "../../model/qa-studio-rules";
import { useFloatingChecklistFocus } from "../view-models/use-floating-checklist-focus";
import type { ProjectRunViewModel } from "../view-models/use-project-run-view-model";
import type { QaPromotionViewModel } from "../view-models/use-qa-promotion-view-model";
import { useStudioRunsViewModel } from "../view-models/use-studio-runs-view-model";
import type { QaRunViewModel } from "../view-models/use-qa-run-view-model";
import type { StudioChecklistsViewModel } from "../view-models/use-studio-checklists-view-model";
import {
  useStudioViewportViewModel,
  type StudioViewportViewModel,
} from "../view-models/use-studio-viewport-view-model";
import { PoAcceptancePanel } from "./po-acceptance-panel";
import { PreviewPane } from "./preview-pane";
import { ProjectRunPanel } from "./project-run-panel";
import { PromotionCard } from "./promotion-card";
import { RunPanel } from "./run-panel";
import { ChecklistIcon, DockIcon, MinimizeIcon, SwapIcon } from "./studio-icons";
import { StudioToolbar } from "./studio-toolbar";

function StudioNotice({
  title,
  text,
  tone,
  onRetry,
}: Readonly<{ title: string; text: string; tone?: "danger"; onRetry?: () => void }>) {
  return (
    <div className={`qa-panel-state${tone ? ` qa-panel-state--${tone}` : ""}`} role={tone ? "alert" : undefined}>
      <h3 className="qa-panel-state__title">{title}</h3>
      <p className="qa-panel-state__text">{text}</p>
      {onRetry ? (
        <button type="button" className="ghost-button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

/** Which studio the shell is: the QA Team's QA Studio, or a Product owner's PO Studio. */
export type StudioKind = "qa" | "po";

const DRAWER_TITLES: Record<StudioKind, string> = { qa: "QA checklist", po: "Acceptance" };

function ChecklistPicker({ vm }: Readonly<{ vm: StudioChecklistsViewModel }>) {
  const selected = vm.selected;
  if (!selected) return null;
  return (
    <div className="qa-run-card__head">
      {vm.checklists.length > 1 ? (
        <label className="qa-run-card__picker">
          <span className="qa-toolbar__label">Checklist</span>
          <select
            className="hier-select"
            value={selected.id}
            onChange={(event) => vm.select(event.target.value)}
          >
            {vm.checklists.map((checklist) => (
              <option key={checklist.id} value={checklist.id}>
                {checklist.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="qa-run-card__picker">
          <span className="qa-toolbar__label">Checklist</span>
          <h3 className="qa-run-card__title">{selected.name}</h3>
        </div>
      )}
      <span className="qa-run-card__count">{itemCountLabel(selected.items.length)}</span>
    </div>
  );
}

/**
 * Why no new repository run can start, once the server gates by Project: the
 * repository's runs are history (QA verifies its Project), or it is not in a
 * Project at all. Null on an older backend, which still runs per repository.
 */
function legacyStartBlock(promotion: QaPromotionViewModel): string | null {
  const scope = promotion.data?.scope ?? null;
  if (scope === "unfiled") return UNFILED_REASON;
  if (scope === "project") return QA_ERROR_MESSAGES.QA_RUN_LEGACY_READONLY;
  return null;
}

/** The right pane: pick a checklist, then the run for it on the branch under test. */
function RunColumn({
  projectId,
  appRole,
  checklists,
  viewport,
  run,
  startBlockedReason,
}: Readonly<{
  projectId: string;
  appRole: AppRole | null | undefined;
  checklists: StudioChecklistsViewModel;
  viewport: StudioViewportViewModel;
  run: QaRunViewModel;
  startBlockedReason: string | null;
}>) {
  if (checklists.status === "loading") return <RunSkeletonCard />;
  if (checklists.status === "error") {
    return (
      <StudioNotice
        title="Checklists did not load"
        text={checklists.error ?? ""}
        tone="danger"
        onRetry={checklists.reload}
      />
    );
  }
  if (!checklists.selected) {
    return (
      <StudioNotice
        title="No checklist to verify"
        text={
          startBlockedReason ??
          "When a team lead shares a QA checklist to this project, it can be verified here against each deployed branch."
        }
      />
    );
  }
  return (
    <div className="qa-run-card">
      {startBlockedReason ? <p className="qa-run-card__history">{startBlockedReason}</p> : null}
      <ChecklistPicker vm={checklists} />
      {viewport.environment ? (
        <RunPanel
          projectId={projectId}
          vm={run}
          branch={viewport.environment.branch}
          appRole={appRole}
          startBlockedReason={startBlockedReason}
        />
      ) : (
        <p className="qa-run-card__wait">{NO_QA_ENVIRONMENT.runText}</p>
      )}
    </div>
  );
}

function RunSkeletonCard() {
  return <div className="hier-skeleton qa-skeleton-card" aria-hidden="true" />;
}

function PreviewColumn({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
  if (vm.status === "loading") return <div className="hier-skeleton qa-skeleton-stage" aria-hidden="true" />;
  if (vm.status === "error") {
    return (
      <StudioNotice title="Environments did not load" text={vm.error ?? ""} tone="danger" onRetry={vm.retry} />
    );
  }
  if (vm.environments.length === 0) {
    // Never another branch instead: QA runs are only accepted on the QA branch.
    return (
      <StudioNotice
        title={vm.providerError ? "Deployments could not be read" : NO_QA_ENVIRONMENT.title}
        text={vm.providerError ?? NO_QA_ENVIRONMENT.text}
      />
    );
  }
  return <PreviewPane vm={vm} />;
}

/** The floating drawer's header: what it is, how far the run is, and where it goes. */
/** What the drawer and its launcher read of a run: a repository run, or a Project run. */
type DrawerRun = Pick<QaRun, "summary"> & Partial<Pick<QaRun, "automation">>;

function DrawerHeader({
  vm,
  run,
  title,
  drawerId,
  headingId,
  headingRef,
}: Readonly<{
  vm: StudioViewportViewModel;
  run: DrawerRun | null;
  title: string;
  drawerId: string;
  headingId: string;
  headingRef: Ref<HTMLHeadingElement>;
}>) {
  const other = vm.floatingSide === "right" ? "left" : "right";
  return (
    <div className="qa-drawer__head">
      <div className="qa-drawer__heading">
        <ChecklistIcon />
        <h2 className="qa-drawer__title" id={headingId} ref={headingRef} tabIndex={-1}>
          {title}
        </h2>
        {run ? <span className="qa-drawer__progress">{passedLabel(run)}</span> : null}
      </div>
      <div className="qa-drawer__actions">
        <button
          type="button"
          className="qa-drawer__button"
          onClick={vm.snapChecklist}
          aria-label={`Move to the ${other} side`}
          title={`Move to the ${other} side`}
        >
          <SwapIcon />
        </button>
        <button
          type="button"
          className="qa-drawer__button"
          onClick={vm.exitFullScreen}
          aria-label="Dock beside the page"
          title="Dock beside the page (exit full screen)"
        >
          <DockIcon />
        </button>
        <button
          type="button"
          className="qa-drawer__button"
          onClick={vm.minimizeChecklist}
          aria-label="Minimize checklist"
          aria-expanded="true"
          aria-controls={drawerId}
          title="Minimize checklist"
        >
          <MinimizeIcon />
        </button>
      </div>
    </div>
  );
}

/** The pill that brings a minimized drawer back, with the run's progress and CI state. */
function ChecklistLauncher({
  vm,
  run,
  drawerId,
  launcherRef,
}: Readonly<{
  vm: StudioViewportViewModel;
  run: DrawerRun | null;
  drawerId: string;
  launcherRef: Ref<HTMLButtonElement>;
}>) {
  const signal = automationSignal(run ? { automation: run.automation } : null);
  return (
    <button
      ref={launcherRef}
      type="button"
      className="qa-launcher"
      onClick={vm.toggleChecklist}
      aria-expanded={vm.isChecklistOpen}
      aria-controls={drawerId}
    >
      <ChecklistIcon />
      <span className="qa-launcher__text">{launcherLabel(run)}</span>
      <span className="qa-launcher__dot" data-tone={signal.tone} title={signal.label} aria-hidden="true" />
      <span className="sr-only">{signal.label}</span>
    </button>
  );
}

/** "docked" beside the page, or the full-screen drawer "open" / "minimized". */
function checklistMode(vm: StudioViewportViewModel): "docked" | "open" | "minimized" {
  if (!vm.isFullScreen) return "docked";
  return vm.isChecklistOpen ? "open" : "minimized";
}

type CommitChip = { commitSha: string | null; commitSource: QaRunViewModel["commitSource"] } | null;

/** What the toolbar's commit chip and the drawer/launcher show, once the run lookup has answered. */
function runSnapshot(run: QaRunViewModel): { commit: CommitChip; current: QaRun | null } {
  if (run.status !== "ready") return { commit: null, current: null };
  return { commit: { commitSha: run.commitSha, commitSource: run.commitSource }, current: run.run };
}

/** The same, for a Project run: this repository's uat head, and the Project run. */
function projectSnapshot(run: ProjectRunViewModel, projectId: string): { commit: CommitChip; current: DrawerRun | null } {
  if (run.status !== "ready") return { commit: null, current: null };
  const head = run.heads.find((entry) => entry.projectId === projectId) ?? null;
  return { commit: head ? { commitSha: head.currentSha, commitSource: null } : null, current: run.run };
}

/**
 * The run column's one container. Docked it is a plain column; in full screen
 * CSS floats it as a drawer and it gains a region role and a header. The
 * promotion card and the column inside (`children`) keep their places either
 * way, so neither ever remounts.
 */
function RunDock({
  vm,
  run,
  title,
  drawerId,
  headingId,
  headingRef,
  promotion,
  children,
}: Readonly<{
  vm: StudioViewportViewModel;
  run: DrawerRun | null;
  title: string;
  drawerId: string;
  headingId: string;
  headingRef: Ref<HTMLHeadingElement>;
  promotion: ReactNode;
  children: ReactNode;
}>) {
  const floating = vm.isFullScreen;
  return (
    <div
      className="qa-studio__run"
      id={drawerId}
      role={floating ? "region" : undefined}
      aria-labelledby={floating ? headingId : undefined}
    >
      {floating ? (
        <DrawerHeader vm={vm} run={run} title={title} drawerId={drawerId} headingId={headingId} headingRef={headingRef} />
      ) : null}
      {promotion}
      {children}
    </div>
  );
}

/**
 * The run column's content: nothing yet while the repository's Project is
 * read, the Project's QA run for a repository filed under a Project (in PO
 * Studio, the acceptance around it), else the per-repository checklist run
 * (history once the server gates by Project) in either studio.
 */
function StudioColumn({
  studio,
  onOpenQaRun,
  qaScope,
  projectMode,
  projectRun,
  projectId,
  appRole,
  checklists,
  viewport,
  run,
  promotion,
}: Readonly<{
  studio: StudioKind;
  onOpenQaRun?: () => void;
  qaScope: QaScope;
  projectMode: boolean;
  projectRun: ProjectRunViewModel;
  projectId: string;
  appRole: AppRole | null | undefined;
  checklists: StudioChecklistsViewModel;
  viewport: StudioViewportViewModel;
  run: QaRunViewModel;
  promotion: QaPromotionViewModel;
}>) {
  if (qaScope.kind === "pending") return <RunSkeletonCard />;
  if (studio === "po" && projectMode) {
    return (
      <PoAcceptancePanel
        qaScope={qaScope}
        projectRun={projectRun}
        promotion={promotion}
        appRole={appRole}
        onOpenQaRun={onOpenQaRun}
      />
    );
  }
  if (projectMode && qaScope.kind === "project") {
    return (
      <div className="qa-run-card">
        <div className="qa-run-card__head">
          <div className="qa-run-card__picker">
            <span className="qa-toolbar__label">Project QA run</span>
            <h3 className="qa-run-card__title">{qaScope.projectName}</h3>
          </div>
        </div>
        <ProjectRunPanel deliveryProjectId={qaScope.deliveryProjectId} vm={projectRun} appRole={appRole} />
      </div>
    );
  }
  return (
    <RunColumn
      projectId={projectId}
      appRole={appRole}
      checklists={checklists}
      viewport={viewport}
      run={run}
      startBlockedReason={legacyStartBlock(promotion)}
    />
  );
}

/** Loading reserves the frame's height; a message sizes to itself. */
function previewFramed(vm: StudioViewportViewModel): "true" | "false" {
  return vm.status === "loading" || vm.canFrame ? "true" : "false";
}

/**
 * QA Studio: the deployed page on the left, the checklist being verified on
 * the right, side by side so a tester never leaves the page to record what
 * they saw. Every right comes from the server; this view only arranges it.
 *
 * The same shell is PO Studio (`studio="po"`): the same uat preview, frames
 * and layouts, with the Product owner's acceptance and the merge to main in
 * the column instead of the items QA verifies.
 *
 * Docked, `data-layout` says how the two share the width (wide preview or
 * split); CSS alone applies it, so switching never touches the tree.
 * Full screen re-lays out the SAME tree with CSS (`data-full-screen`): the
 * studio covers the viewport and the run column becomes a floating drawer.
 * The run column is mounted exactly once — never a second copy for the
 * drawer — because it owns item drafts, the sign-off dialog, the export timer
 * and automation polling. Minimizing only hides it. Nothing is portalled: the
 * theme tokens are scoped to the dashboard shell, and the sign-off dialog
 * needs the viewport, not a drawer, as its containing block.
 */
export function QaStudioPanel({
  projectId,
  appRole,
  projectName,
  qaScope = REPOSITORY_SCOPE,
  studio = "qa",
  onOpenQaRun,
}: Readonly<{
  projectId: string;
  appRole: AppRole | null | undefined;
  /** How the merge confirmation names the project, e.g. "tone/storefront-web". */
  projectName?: string;
  /**
   * Where this repository's QA happens. Filed under a Project, the run column
   * is the Project's QA run; otherwise (or on a server without Project runs)
   * it is the per-repository checklist run, as before.
   */
  qaScope?: QaScope;
  /** QA Studio (the default) or PO Studio. Decides the tabpanel id and the column. */
  studio?: StudioKind;
  /** PO Studio's way to the Project's QA run, while the release candidate is locked. */
  onOpenQaRun?: () => void;
}>) {
  const viewport = useStudioViewportViewModel({ projectId, enabled: Boolean(projectId) });
  const runs = useStudioRunsViewModel({ projectId, appRole, qaScope, branch: viewport.environment?.branch ?? null });
  const { projectMode, projectRun, checklists, run, promotion } = runs;
  const focus = useFloatingChecklistFocus({
    isFullScreen: viewport.isFullScreen,
    isChecklistOpen: viewport.isChecklistOpen,
  });
  const drawerId = useId();
  const headingId = useId();
  const snapshot = projectMode ? projectSnapshot(projectRun, projectId) : runSnapshot(run);
  const mode = checklistMode(viewport);

  return (
    <div
      role="tabpanel"
      id={`project-detail-panel-${studio}`}
      aria-labelledby={`project-detail-tab-${studio}`}
      className="qa-studio"
      data-studio={studio}
      data-full-screen={String(viewport.isFullScreen)}
      data-layout={viewport.layout}
      data-checklist={mode}
      data-side={viewport.floatingSide}
    >
      {viewport.environments.length > 0 ? (
        <StudioToolbar vm={viewport} commit={snapshot.commit} fullScreenRef={focus.toggleRef} />
      ) : null}
      <div className="qa-studio__panes">
        <div className="qa-studio__preview" data-framed={previewFramed(viewport)}>
          <PreviewColumn vm={viewport} />
        </div>
        <RunDock
          vm={viewport}
          run={snapshot.current}
          title={DRAWER_TITLES[studio]}
          drawerId={drawerId}
          headingId={headingId}
          headingRef={focus.drawerRef}
          promotion={<PromotionCard vm={promotion} projectName={projectName ?? projectId} />}
        >
          <StudioColumn
            studio={studio}
            onOpenQaRun={onOpenQaRun}
            qaScope={qaScope}
            projectMode={projectMode}
            projectRun={projectRun}
            projectId={projectId}
            appRole={appRole}
            checklists={checklists}
            viewport={viewport}
            run={run}
            promotion={promotion}
          />
        </RunDock>
      </div>
      {mode === "minimized" ? (
        <ChecklistLauncher vm={viewport} run={snapshot.current} drawerId={drawerId} launcherRef={focus.launcherRef} />
      ) : null}
    </div>
  );
}
