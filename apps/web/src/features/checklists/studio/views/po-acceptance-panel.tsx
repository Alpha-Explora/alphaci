"use client";

import "./po-studio.css";

import type { AppRole } from "@/shared/api/contracts";

import {
  PO_READY_TEXT,
  PO_READY_TITLE,
  PO_WAITING_TITLE,
  poAcceptanceState,
  poWaitingText,
} from "../../model/po-studio-rules";
import { headLabel, resolveProjectRunPermissions } from "../../model/project-run-rules";
import type { ProjectQaRun } from "../../model/project-run-types";
import { UNFILED_REASON } from "../../model/qa-promotion-rules";
import type { QaScope } from "../../model/qa-scope";
import type { ProjectRunViewModel } from "../view-models/use-project-run-view-model";
import { useProjectReopenViewModel } from "../view-models/use-project-signoff-view-model";
import type { QaPromotionViewModel } from "../view-models/use-qa-promotion-view-model";
import { RunSummary, SignoffBanner } from "./run-signoff";

function signedSubject(run: ProjectQaRun): string {
  if (run.repositories.length === 0) return run.deliveryProjectName;
  return run.repositories.map((head) => headLabel(head.repoFullName, head.runSha)).join(", ");
}

/**
 * What QA did with the release candidate: how far the run got, and once it
 * is signed off, by whom, with which verdict, on which heads — with Reopen
 * for a Product owner who does not accept it.
 */
function QaRunAcceptance({
  deliveryProjectId,
  vm,
  run,
  appRole,
}: Readonly<{
  deliveryProjectId: string;
  vm: ProjectRunViewModel;
  run: ProjectQaRun;
  appRole: AppRole | null | undefined;
}>) {
  const permissions = resolveProjectRunPermissions(run, appRole);
  const reopen = useProjectReopenViewModel({ deliveryProjectId, run, permissions, onRun: vm.applyRun });
  return (
    <>
      <RunSummary run={run} />
      <SignoffBanner run={run} subject={signedSubject(run)} reopen={reopen} />
    </>
  );
}

/**
 * PO Studio's column: whether the Project's release candidate is ready for
 * production, and why not yet. The merge itself is the tab bar's readiness
 * chip and Merge to main above it (the same ones QA Studio shows); this panel
 * is the acceptance around it.
 * Verifying items stays with the QA run, a click away in the Checklists tab.
 */
export function PoAcceptancePanel({
  qaScope,
  projectRun,
  promotion,
  appRole,
  onOpenQaRun,
}: Readonly<{
  qaScope: QaScope;
  projectRun: ProjectRunViewModel;
  promotion: QaPromotionViewModel;
  appRole: AppRole | null | undefined;
  /** Opens the Project's QA run (the Checklists tab). */
  onOpenQaRun?: () => void;
}>) {
  const state = poAcceptanceState({ scope: qaScope, promotionStatus: promotion.status, promotion: promotion.data });
  if (state === "loading") return <div className="hier-skeleton qa-skeleton-card" aria-hidden="true" />;
  if (state === "unfiled" || qaScope.kind !== "project") {
    return (
      <div className="qa-panel-state">
        <h3 className="qa-panel-state__title">Nothing to accept here</h3>
        <p className="qa-panel-state__text">{UNFILED_REASON}</p>
      </div>
    );
  }
  const run = projectRun.status === "ready" ? projectRun.run : null;
  const ready = state === "ready";
  return (
    <div className="qa-run-card po-accept" data-state={state}>
      <div className="qa-run-card__head">
        <div className="qa-run-card__picker">
          <span className="qa-toolbar__label">Product acceptance</span>
          <h3 className="qa-run-card__title">{qaScope.projectName}</h3>
        </div>
      </div>
      <div className="po-accept__status" role="status">
        <p className="po-accept__title">{ready ? PO_READY_TITLE : PO_WAITING_TITLE}</p>
        <p className="po-accept__text">{ready ? PO_READY_TEXT : poWaitingText(run)}</p>
      </div>
      {run ? (
        <QaRunAcceptance
          key={run.id}
          deliveryProjectId={qaScope.deliveryProjectId}
          vm={projectRun}
          run={run}
          appRole={appRole}
        />
      ) : null}
      {!ready && onOpenQaRun ? (
        <button type="button" className="ghost-button po-accept__open" onClick={onOpenQaRun}>
          View the QA run
        </button>
      ) : null}
    </div>
  );
}
