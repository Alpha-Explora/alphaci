"use client";

import type { AppRole } from "@/shared/api/contracts";

import { useRequestRetestViewModel } from "../../returned";
import {
  agoLabel,
  commitLabel,
  roleCanStartRun,
  shortSha,
} from "../../model/qa-run-rules";
import type { QaRun } from "../../model/qa-run-types";
import type { QaRunViewModel } from "../view-models/use-qa-run-view-model";
import { useQaExportViewModel, type QaExportViewModel } from "../view-models/use-qa-export-view-model";
import { useQaItemEditorViewModel } from "../view-models/use-qa-item-editor-view-model";
import { useQaReopenViewModel } from "../view-models/use-qa-reopen-view-model";
import { useQaSignoffViewModel } from "../view-models/use-qa-signoff-view-model";
import { ExportMenu, ExportStatus } from "./export-menu";
import { RunItem } from "./run-item";
import { RunSummary, SignoffBanner, SignoffDialog, SignoffFooter } from "./run-signoff";

function PanelState({
  title,
  text,
  tone,
  children,
}: Readonly<{
  title: string;
  text: string;
  tone?: "danger";
  children?: React.ReactNode;
}>) {
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

/** No run on this commit yet: start one, or say who can. */
function StartRun({
  vm,
  branch,
  appRole,
}: Readonly<{ vm: QaRunViewModel; branch: string; appRole: AppRole | null | undefined }>) {
  const starting = vm.status === "starting";
  if (!vm.commitSha) {
    return (
      <PanelState
        title={`No commit found on ${branch}`}
        text="ALPHACI could not find a commit to test on this branch yet. Push to it or deploy it, then reload."
      >
        <button type="button" className="ghost-button" onClick={vm.reload}>
          Reload
        </button>
      </PanelState>
    );
  }
  if (!roleCanStartRun(appRole)) {
    return (
      <PanelState
        title={`No QA run on ${commitLabel(branch, vm.commitSha)} yet`}
        text="QA Team members, Team leads and Admins start verification runs. Once one starts, its items and results appear here."
      />
    );
  }
  return (
    <PanelState
      title="Nothing verified on this commit yet"
      text="A run records each item's result against this exact commit, so the next deploy starts a fresh one."
    >
      <button
        type="button"
        className="primary-button"
        disabled={starting}
        onClick={() => void vm.start()}
      >
        {starting ? "Starting…" : `Start QA run on ${branch} @ ${shortSha(vm.commitSha)}`}
      </button>
      {vm.startError ? (
        <p className="qa-form-error" role="alert">
          {vm.startError.message}
        </p>
      ) : null}
    </PanelState>
  );
}

/** Who started the run, and the export menu — offered to everyone who can see the run. */
function RunHeader({ run, exporter }: Readonly<{ run: QaRun; exporter: QaExportViewModel }>) {
  const ago = agoLabel(run.createdAt);
  return (
    <div className="qa-run__head">
      <div className="qa-run__head-row">
        <p className="qa-run-card__started">
          Started by <strong>@{run.createdBy.login}</strong>
          {ago ? ` · ${ago}` : ""} · checklist version {run.checklistVersion}
        </p>
        <ExportMenu vm={exporter} />
      </div>
      <ExportStatus vm={exporter} />
    </div>
  );
}

/** A run and everything that can be done to it. Mounted only once a run exists. */
function RunBody({ projectId, vm, run }: Readonly<{ projectId: string; vm: QaRunViewModel; run: QaRun }>) {
  const editor = useQaItemEditorViewModel({ projectId, run, onRun: vm.applyRun });
  const signoff = useQaSignoffViewModel({ projectId, run, onRun: vm.applyRun });
  const reopen = useQaReopenViewModel({ projectId, run, onRun: vm.applyRun });
  const retest = useRequestRetestViewModel({ projectId, onDone: vm.applyRun });
  const exporter = useQaExportViewModel({ projectId, runId: run.id });
  const items = [...run.items].sort((a, b) => a.position - b.position);
  const open = run.status === "open";

  return (
    <div className="qa-run">
      <RunHeader run={run} exporter={exporter} />
      <SignoffBanner run={run} reopen={reopen} />
      <RunSummary run={run} />
      <ol className="qa-run__items">
        {items.map((item, index) => (
          <RunItem
            key={item.id}
            item={item}
            index={index}
            run={run}
            editor={editor}
            retest={retest}
            onReload={vm.reload}
          />
        ))}
      </ol>
      {open ? <SignoffFooter vm={signoff} /> : null}
      {signoff.canSignOff ? <SignoffDialog vm={signoff} run={run} /> : null}
    </div>
  );
}

/** The right pane's run area for one checklist on one branch. */
export function RunPanel({
  projectId,
  vm,
  branch,
  appRole,
}: Readonly<{
  projectId: string;
  vm: QaRunViewModel;
  branch: string;
  appRole: AppRole | null | undefined;
}>) {
  if (vm.status === "idle" || vm.status === "loading") return <RunSkeleton />;
  if (vm.status === "error") {
    return (
      <PanelState title="The QA run did not load" text={vm.error ?? ""} tone="danger">
        <button type="button" className="ghost-button" onClick={vm.reload}>
          Try again
        </button>
      </PanelState>
    );
  }
  if (!vm.run) return <StartRun vm={vm} branch={branch} appRole={appRole} />;
  // Keyed by run: a reopened or newly started run gets fresh drafts and dialogs.
  return <RunBody key={vm.run.id} projectId={projectId} vm={vm} run={vm.run} />;
}
