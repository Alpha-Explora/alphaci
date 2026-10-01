"use client";

import "./promotion.css";

import { useId } from "react";

import { FormDialog } from "@/features/groups/workspace";

import { VerdictPill } from "../../items";
import { headChangeMessage, headLabel, REQUIREMENTS_CHANGED_NOTE } from "../../model/project-run-rules";
import {
  approvedCountLabel,
  blockingReasons,
  mergeConfirmText,
  promotionChecklistState,
  promotionRoute,
  promotionRunState,
  promotionTitle,
} from "../../model/qa-promotion-rules";
import type { QaPromotionChecklist, QaPromotionStatus } from "../../model/qa-promotion-types";
import { shortSha } from "../../model/qa-run-rules";
import type { QaPromotionViewModel } from "../view-models/use-qa-promotion-view-model";
import { useRememberedFlag } from "../view-models/use-remembered-flag";
import { PromotionOutcome, PullRequestLink } from "./promotion-outcome";
import { CheckIcon, ChevronDownIcon, MergeIcon } from "./studio-icons";

/** Per viewer, in this browser: whether the card is folded to its one-line head. */
export const PROMOTION_CARD_COLLAPSED_KEY = "alphaci.qa-studio.promotion-card.collapsed";

type CardProps = Readonly<{ vm: QaPromotionViewModel; projectName: string }>;

function ChecklistRow({ entry }: Readonly<{ entry: QaPromotionChecklist }>) {
  const state = promotionChecklistState(entry);
  return (
    <li className="qa-promo__row" data-tone={state.tone}>
      <span className="qa-promo__tick" aria-hidden="true">
        {state.approved ? <CheckIcon /> : <span className="qa-promo__dot" />}
      </span>
      <span className="qa-promo__row-text">
        <span className="qa-promo__name">{entry.name}</span>
        <span className="qa-promo__state">{state.label}</span>
      </span>
      {entry.verdict ? <VerdictPill verdict={entry.verdict} /> : null}
    </li>
  );
}

/**
 * The Project-level gate: the Project's latest signed-off run, then each
 * repository's uat head against what that run verified.
 */
function ProjectGate({ data }: Readonly<{ data: QaPromotionStatus }>) {
  const state = promotionRunState(data);
  return (
    <>
      <ul className="qa-promo__rows" aria-label="Project QA run">
        <li className="qa-promo__row" data-tone={state.tone}>
          <span className="qa-promo__tick" aria-hidden="true">
            {state.approved ? <CheckIcon /> : <span className="qa-promo__dot" />}
          </span>
          <span className="qa-promo__row-text">
            <span className="qa-promo__name">{data.deliveryProject?.name ?? "Project"} QA run</span>
            <span className="qa-promo__state">{state.label}</span>
          </span>
          {data.run?.verdict ? <VerdictPill verdict={data.run.verdict} /> : null}
        </li>
        {data.repositories.map((head) => {
          const change = data.run ? headChangeMessage(head) : null;
          return (
            <li key={head.projectId} className="qa-promo__row" data-tone={change ? "warning" : "neutral"}>
              <span className="qa-promo__tick" aria-hidden="true">
                <span className="qa-promo__dot" />
              </span>
              <span className="qa-promo__row-text">
                <span className="qa-promo__name">{headLabel(head.repoFullName, head.currentSha)}</span>
                <span className="qa-promo__state">{change ?? "Covered by the run"}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {data.requirementsChanged ? (
        <p className="qa-promo__muted">
          Requirements changed since sign-off. {REQUIREMENTS_CHANGED_NOTE}
        </p>
      ) : null}
    </>
  );
}

function Blocking({ data, id }: Readonly<{ data: QaPromotionStatus; id: string }>) {
  const reasons = blockingReasons(data);
  if (reasons.length === 0) return null;
  return (
    <div className="qa-promo__reasons" id={id}>
      <p className="qa-promo__label">What blocks the merge</p>
      <ul>
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
  );
}

/** The PR link for everyone, and who merges for those who cannot. */
function CardFoot({ vm, data }: Readonly<{ vm: QaPromotionViewModel; data: QaPromotionStatus }>) {
  return (
    <div className="qa-promo__foot">
      {data.pullRequest ? (
        <PullRequestLink pullRequest={data.pullRequest} label={`Promotion PR #${data.pullRequest.number}`} />
      ) : (
        <span className="qa-promo__muted">No promotion pull request is open yet.</span>
      )}
      {vm.canMerge ? null : (
        <span className="qa-promo__muted">
          {data.scope
            ? `Product owners merge ${data.qaBranch} into ${data.targetBranch} once the Project's QA run is approved.`
            : `Team leads merge ${data.qaBranch} into ${data.targetBranch} once every checklist is approved.`}
        </span>
      )}
    </div>
  );
}

function MergeButton({ vm, whyId }: Readonly<{ vm: QaPromotionViewModel; whyId: string }>) {
  if (!vm.canMerge) return null;
  const busy = vm.mergeState === "merging";
  return (
    <button
      type="button"
      className="primary-button qa-promo__merge"
      disabled={Boolean(vm.disabledReason) || vm.mergeState !== "idle"}
      aria-describedby={vm.disabledReason ? whyId : undefined}
      onClick={vm.openConfirm}
    >
      <MergeIcon />
      {busy ? "Merging…" : "Merge to main"}
    </button>
  );
}

function CardHead({
  vm,
  data,
  collapsed,
  onToggle,
  bodyId,
  whyId,
}: Readonly<{
  vm: QaPromotionViewModel;
  data: QaPromotionStatus;
  collapsed: boolean;
  onToggle: () => void;
  bodyId: string;
  whyId: string;
}>) {
  return (
    <div className="qa-promo__head">
      <button
        type="button"
        className="qa-promo__toggle"
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        onClick={onToggle}
      >
        <ChevronDownIcon />
        <span className="qa-promo__mark" aria-hidden="true">
          <MergeIcon />
        </span>
        <span className="qa-promo__titles">
          <span className="qa-promo__title">{promotionTitle(data)}</span>
          <span className="qa-promo__route">
            <code>{promotionRoute(data)}</code>
            <span>{approvedCountLabel(data)}</span>
          </span>
        </span>
      </button>
      <MergeButton vm={vm} whyId={whyId} />
    </div>
  );
}

function MergeDialog({ vm, data, projectName }: Readonly<{ vm: QaPromotionViewModel; data: QaPromotionStatus; projectName: string }>) {
  if (!vm.canMerge) return null;
  const pr = data.pullRequest;
  return (
    <FormDialog
      open={vm.mergeState !== "idle"}
      onClose={vm.cancelConfirm}
      title={`Merge ${data.qaBranch} into ${data.targetBranch}?`}
      description={mergeConfirmText(data, projectName)}
      submitLabel="Merge to main"
      submitting={vm.mergeState === "merging"}
      error={vm.dialogError}
      onSubmit={() => void vm.confirmMerge()}
    >
      <dl className="qa-promo-confirm">
        <div>
          <dt>Project</dt>
          <dd>{projectName}</dd>
        </div>
        <div>
          <dt>Commit</dt>
          <dd>
            <code>
              {data.qaBranch} @ {shortSha(data.headSha)}
            </code>
          </dd>
        </div>
        <div>
          <dt>Pull request</dt>
          <dd>{pr ? `#${pr.number}` : `A new ${data.qaBranch} → ${data.targetBranch} pull request`}</dd>
        </div>
        <div>
          <dt>QA</dt>
          <dd>{approvedCountLabel(data)}</dd>
        </div>
      </dl>
      <p className="qa-promo-confirm__note">
        GitHub&apos;s branch rules still apply: if {data.targetBranch} needs an approving review, GitHub refuses the
        merge and ALPHACI shows its reason.
      </p>
    </FormDialog>
  );
}

function CardBody({
  vm,
  data,
  bodyId,
  reasonsId,
  collapsed,
}: Readonly<{ vm: QaPromotionViewModel; data: QaPromotionStatus; bodyId: string; reasonsId: string; collapsed: boolean }>) {
  return (
    <div id={bodyId} className="qa-promo__body" hidden={collapsed}>
      {data.scope === "project" ? <ProjectGate data={data} /> : null}
      {/* The deprecated per-checklist list: only an older backend's gate. */}
      {!data.scope && data.checklists.length > 0 ? (
        <ul className="qa-promo__rows" aria-label="Shared checklists on this commit">
          {data.checklists.map((entry) => (
            <ChecklistRow key={entry.id} entry={entry} />
          ))}
        </ul>
      ) : null}
      <Blocking data={data} id={reasonsId} />
      <CardFoot vm={vm} data={data} />
    </div>
  );
}

function ReadyCard({ vm, data, projectName }: Readonly<{ vm: QaPromotionViewModel; data: QaPromotionStatus; projectName: string }>) {
  // Folded by default: the head already answers "ready or not" (and, for a
  // lead, why the button is disabled), and the run column's item list needs
  // the height. Unfolding is remembered per viewer.
  const [collapsed, toggle] = useRememberedFlag(PROMOTION_CARD_COLLAPSED_KEY, true);
  const bodyId = useId();
  const reasonsId = useId();
  const whyId = useId();
  return (
    <section
      className="qa-promo"
      aria-label="Production readiness"
      data-ready={data.eligible ? "true" : "false"}
      data-collapsed={collapsed ? "true" : "false"}
      aria-busy={vm.refreshing}
    >
      <CardHead vm={vm} data={data} collapsed={collapsed} onToggle={toggle} bodyId={bodyId} whyId={whyId} />
      {vm.canMerge && vm.disabledReason ? (
        <p className="qa-promo__why" id={whyId}>
          {vm.disabledReason}
        </p>
      ) : null}
      <CardBody vm={vm} data={data} bodyId={bodyId} reasonsId={reasonsId} collapsed={collapsed} />
      <PromotionOutcome vm={vm} targetBranch={data.targetBranch} />
      <MergeDialog vm={vm} data={data} projectName={projectName} />
    </section>
  );
}

/**
 * QA Studio's "Ready for production" card: whether uat's current commit is
 * QA-approved for main, checklist by checklist, and — for Team leads and
 * Admins the server allows — Merge to main. QA Team sees the same status,
 * read-only. It sits at the top of the run column, so it moves with the
 * column into the full-screen drawer (mounted once, like the column).
 */
export function PromotionCard({ vm, projectName }: CardProps) {
  if (vm.status === "unavailable") return null;
  if (vm.status === "loading") return <div className="hier-skeleton qa-promo-skeleton" aria-hidden="true" />;
  if (vm.status === "error" || !vm.data) {
    return (
      <div className="qa-promo-error" role="alert">
        <p>{vm.error}</p>
        <button type="button" className="ghost-button" onClick={vm.reload}>
          Try again
        </button>
      </div>
    );
  }
  return <ReadyCard vm={vm} data={vm.data} projectName={projectName} />;
}
