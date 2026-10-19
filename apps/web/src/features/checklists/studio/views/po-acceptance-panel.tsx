"use client";

import "./po-studio.css";

import type { AppRole } from "@/shared/api/contracts";

import { IterationWaitingNotice, StartIterationAction } from "../../iteration";
import {
  poAcceptanceState,
  poWaitingText,
  poWaitingTitle,
  type PoAcceptanceState,
} from "../../model/po-studio-rules";
import { resolveProjectRunPermissions } from "../../model/project-run-rules";
import type { ProjectQaRun } from "../../model/project-run-types";
import { UNFILED_REASON } from "../../model/qa-promotion-rules";
import type { QaScope } from "../../model/qa-scope";
import type { ProjectRunViewModel } from "../view-models/use-project-run-view-model";
import { usePoAcceptanceViewModel } from "../view-models/use-po-acceptance-view-model";
import type { PoDeliveryViewModel } from "../view-models/use-po-delivery-view-model";
import type { QaPromotionViewModel } from "../view-models/use-qa-promotion-view-model";
import { useRunTestCasesViewModel } from "../view-models/use-run-test-cases-view-model";
import { PoDeliveredBanner } from "./po-delivery";
import { PoRunItems } from "./po-run-items";
import { RunSummary } from "./run-signoff";

/**
 * The Product owner's check of the release candidate: how far QA got, then
 * every item with QA's verdict and test cases (read-only), and — once QA
 * signed the run off — Pass or Fail on each. Failing reopens the run and
 * returns the story to the Developers. `onChanged` re-reads the readiness
 * chip and Merge to main, which wait for every item to be passed here.
 */
function PoRunCheck({
  deliveryProjectId,
  vm,
  run,
  appRole,
  delivered,
  onChanged,
}: Readonly<{
  deliveryProjectId: string;
  vm: ProjectRunViewModel;
  run: ProjectQaRun;
  appRole: AppRole | null | undefined;
  delivered: boolean;
  onChanged: () => void;
}>) {
  const permissions = resolveProjectRunPermissions(run, appRole);
  const testCases = useRunTestCasesViewModel({
    deliveryProjectId,
    run,
    permissions,
    onRun: vm.applyRun,
    onReload: vm.refresh,
  });
  const acceptance = usePoAcceptanceViewModel({
    deliveryProjectId,
    run,
    canAccept: permissions.canAccept && !delivered,
    onRun: vm.applyRun,
    onReload: vm.refresh,
    onChanged,
  });
  return (
    <>
      <RunSummary run={run} />
      {delivered ? null : (
        <PoRunItems run={run} acceptance={acceptance} testCases={testCases} onReload={vm.refresh} />
      )}
    </>
  );
}

type ProjectScope = Extract<QaScope, { kind: "project" }>;

/**
 * What is still missing before main: QA's sign-off, or the Product owner's
 * own check. Nothing once ready: the tab bar's chip says so.
 */
function AcceptanceStatus({ run }: Readonly<{ run: ProjectQaRun | null }>) {
  return (
    <div className="po-accept__status" role="status">
      <p className="po-accept__title">{poWaitingTitle(run)}</p>
      <p className="po-accept__text">{poWaitingText(run)}</p>
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
 * main; before that, what is still missing (QA's sign-off or the Product
 * owner's check), how far QA got and the Product owner's checklist.
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
        ready ? null : <AcceptanceStatus run={run} />
      )}
      {run ? (
        <PoRunCheck
          key={run.id}
          deliveryProjectId={qaScope.deliveryProjectId}
          vm={projectRun}
          run={run}
          appRole={appRole}
          delivered={delivered}
          onChanged={promotion.reload}
        />
      ) : null}
    </div>
  );
}

/**
 * PO Studio's column: why the Project's release candidate is not ready yet,
 * the Product owner's own check of every item once QA signed it off (Pass,
 * or Fail back to the Developers), and, once every repository reached main,
 * the delivered iteration. The merge itself is the tab bar's readiness chip
 * and Merge to main above it, which wait for every item to be passed here.
 * QA's test cases and results are read-only for the Product owner.
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
