"use client";

import "./qa-studio.css";

import type { AppRole } from "@/shared/api/contracts";

import { itemCountLabel } from "../../model/checklist-rules";
import { useQaRunViewModel, type QaRunViewModel } from "../view-models/use-qa-run-view-model";
import {
  useStudioChecklistsViewModel,
  type StudioChecklistsViewModel,
} from "../view-models/use-studio-checklists-view-model";
import {
  useStudioViewportViewModel,
  type StudioViewportViewModel,
} from "../view-models/use-studio-viewport-view-model";
import { PreviewPane } from "./preview-pane";
import { RunPanel } from "./run-panel";
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

/** The right pane: pick a checklist, then the run for it on the branch under test. */
function RunColumn({
  projectId,
  appRole,
  checklists,
  viewport,
  run,
}: Readonly<{
  projectId: string;
  appRole: AppRole | null | undefined;
  checklists: StudioChecklistsViewModel;
  viewport: StudioViewportViewModel;
  run: QaRunViewModel;
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
        text="When a team lead shares a QA checklist to this project, it can be verified here against each deployed branch."
      />
    );
  }
  return (
    <div className="qa-run-card">
      <ChecklistPicker vm={checklists} />
      {viewport.environment ? (
        <RunPanel
          projectId={projectId}
          vm={run}
          branch={viewport.environment.branch}
          appRole={appRole}
        />
      ) : (
        <p className="qa-run-card__wait">Choose an environment to see its run.</p>
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
    return (
      <StudioNotice
        title="No hosted environment to test"
        text={
          vm.providerError ??
          "Once this project has a frontend deployment, its branches can be opened and tested here."
        }
      />
    );
  }
  return <PreviewPane vm={vm} />;
}

/**
 * QA Studio: the deployed page on the left, the checklist being verified on
 * the right, side by side so a tester never leaves the page to record what
 * they saw. Every right comes from the server; this view only arranges it.
 */
export function QaStudioPanel({
  projectId,
  appRole,
}: Readonly<{ projectId: string; appRole: AppRole | null | undefined }>) {
  const enabled = Boolean(projectId);
  const viewport = useStudioViewportViewModel({ projectId, enabled });
  const checklists = useStudioChecklistsViewModel({ projectId, enabled });
  const run = useQaRunViewModel({
    projectId,
    enabled,
    branch: viewport.environment?.branch ?? null,
    checklistId: checklists.selected?.id ?? null,
  });
  const commit = run.status === "ready" ? { commitSha: run.commitSha, commitSource: run.commitSource } : null;

  return (
    <div
      role="tabpanel"
      id="project-detail-panel-qa"
      aria-labelledby="project-detail-tab-qa"
      className="qa-studio"
    >
      {viewport.environments.length > 0 ? <StudioToolbar vm={viewport} commit={commit} /> : null}
      <div className="qa-studio__panes">
        <div
          className="qa-studio__preview"
          data-framed={viewport.status === "loading" || viewport.canFrame ? "true" : "false"}
        >
          <PreviewColumn vm={viewport} />
        </div>
        <div className="qa-studio__run">
          <RunColumn
            projectId={projectId}
            appRole={appRole}
            checklists={checklists}
            viewport={viewport}
            run={run}
          />
        </div>
      </div>
    </div>
  );
}
