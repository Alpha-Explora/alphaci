"use client";

import "./po-studio.css";

import type { AppRole } from "@/shared/api/contracts";

import { IterationWaitingNotice, StartIterationAction } from "../../iteration";
import {
  PO_READY_TEXT,
  PO_READY_TITLE,
  PO_WAITING_TITLE,
  poAcceptanceState,
  poWaitingText,
  type PoAcceptanceState,
} from "../../model/po-studio-rules";
import { headLabel, resolveProjectRunPermissions } from "../../model/project-run-rules";
import type { ProjectQaRun } from "../../model/project-run-types";
import { UNFILED_REASON } from "../../model/qa-promotion-rules";
import type { QaScope } from "../../model/qa-scope";
import type { ProjectRunViewModel } from "../view-models/use-project-run-view-model";
import { useProjectReopenViewModel } from "../view-models/use-project-signoff-view-model";
import type { PoDeliveryViewModel } from "../view-models/use-po-delivery-view-model";
import type { QaPromotionViewModel } from "../view-models/use-qa-promotion-view-model";
import { useShowRepositories } from "../view-models/repository-visibility";
import { PoDeliveredBanner, PoDeliveryState } from "./po-delivery";
import { PoRunItems } from "./po-run-items";
import { RunSummary, SignoffBanner } from "./run-signoff";

function signedSubject(run: ProjectQaRun, showRepositories: boolean): string {
  if (!showRepositories || run.repositories.length === 0) return run.deliveryProjectName;
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
  const showRepositories = useShowRepositories();
  const reopen = useProjectReopenViewModel({ deliveryProjectId, run, permissions, onRun: vm.applyRun });
  return (
    <>
      <RunSummary run={run} />
      <SignoffBanner run={run} subject={signedSubject(run, showRepositories)} reopen={reopen} />
    </>
  );
}

type ProjectScope = Extract<QaScope, { kind: "project" }>;

/** The acceptance status line: waiting for QA, or ready for main. */
function AcceptanceStatus({ ready, run }: Readonly<{ ready: boolean; run: ProjectQaRun | null }>) {
  return (
    <div className="po-accept__status" role="status">
      <p className="po-accept__title">{ready ? PO_READY_TITLE : PO_WAITING_TITLE}</p>
      <p className="po-accept__text">{ready ? PO_READY_TEXT : poWaitingText(run)}</p>
    </div>
  );
}

/** Delivered, by the promotion status or by the stored iteration. */
function isDelivered(state: PoAcceptanceState, delivery: PoDeliveryViewModel): boolean {
  return state === "delivered" || delivery.iteration.current?.iteration.status === "delivered";
}

/**
 * What follows a delivered iteration in PO Studio: Start iteration N+1 for a
 * Product owner or admin the server lets start; the waiting sentence for
 * anyone it does not; nothing when the server did not say.
 */
function DeliveredNext({ delivery }: Readonly<{ delivery: PoDeliveryViewModel }>) {
  const step = delivery.start.step;
  if (step.kind === "waiting") return <IterationWaitingNotice text={step.text} />;
  return <StartIterationAction vm={delivery.start} />;
}

/**
 * A Project's acceptance: the delivered banner once its iteration reached
 * main; before that, waiting or ready, each covered repository's stored
 * state, and what QA did with the run.
 */
function ProjectAcceptance({
  qaScope,
  state,
  projectRun,
  promotion,
  delivery,
  appRole,
}: Readonly<{
  qaScope: ProjectScope;
  state: PoAcceptanceState;
  projectRun: ProjectRunViewModel;
  promotion: QaPromotionViewModel;
  delivery: PoDeliveryViewModel;
  appRole: AppRole | null | undefined;
}>) {
  const run = projectRun.status === "ready" ? projectRun.run : null;
  const delivered = isDelivered(state, delivery);
  const ready = state === "ready";
  return (
    <div className="qa-run-card po-accept" data-state={delivered ? "delivered" : state}>
      <div className="qa-run-card__head">
        <div className="qa-run-card__picker">
          <span className="qa-toolbar__label">Product acceptance</span>
          <h3 className="qa-run-card__title">{qaScope.projectName}</h3>
        </div>
      </div>
      {delivered ? (
        <PoDeliveredBanner
          current={delivery.iteration.current}
          fallback={promotion.data?.iteration ?? null}
          next={delivery.start.step.kind === "none" ? null : <DeliveredNext delivery={delivery} />}
        />
      ) : (
        <>
          <AcceptanceStatus ready={ready} run={run} />
          <PoDeliveryState vm={delivery} projectName={qaScope.projectName} />
        </>
      )}
      {run ? (
        <QaRunAcceptance
          key={run.id}
          deliveryProjectId={qaScope.deliveryProjectId}
          vm={projectRun}
          run={run}
          appRole={appRole}
        />
      ) : null}
      {run && !delivered ? <PoRunItems run={run} /> : null}
    </div>
  );
}

/**
 * PO Studio's column: whether the Project's release candidate is ready for
 * production, and why not yet; each repository's state on the way to main;
 * and, once every repository reached main, the delivered iteration. The
 * merge itself is the tab bar's readiness chip and Merge to main above it
 * (the same ones QA Studio shows; on a Project of two or more repositories
 * it merges every one not in main yet); this panel is the acceptance around
 * it. QA's results are here too, read-only (PoRunItems); verifying items
 * stays with the QA Team.
 */
export function PoAcceptancePanel({
  qaScope,
  projectRun,
  promotion,
  delivery,
  appRole,
}: Readonly<{
  qaScope: QaScope;
  projectRun: ProjectRunViewModel;
  promotion: QaPromotionViewModel;
  /** The Project's delivery, shared with the tab bar's Merge to main. */
  delivery: PoDeliveryViewModel;
  appRole: AppRole | null | undefined;
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
  return (
    <ProjectAcceptance
      qaScope={qaScope}
      state={state}
      projectRun={projectRun}
      promotion={promotion}
      delivery={delivery}
      appRole={appRole}
    />
  );
}
