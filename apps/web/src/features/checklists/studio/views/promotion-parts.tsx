"use client";

import "./promotion.css";

import { FormDialog } from "@/features/groups/workspace";

import { VerdictPill } from "../../items";
import { projectMergeConfirmText } from "../../model/iteration-rules";
import { headChangeMessage, headLabel } from "../../model/project-run-rules";
import {
  approvedCountLabel,
  blockingReasons,
  deliveredNote,
  mergeConfirmText,
  projectReasons,
  promotionChecklistState,
  promotionRunState,
} from "../../model/qa-promotion-rules";
import type { QaPromotionChecklist, QaPromotionStatus } from "../../model/qa-promotion-types";
import { shortSha } from "../../model/qa-run-rules";
import type { QaPromotionViewModel } from "../view-models/use-qa-promotion-view-model";
import { useShowRepositories } from "../view-models/repository-visibility";
import { PullRequestRef } from "./promotion-outcome";
import { CheckIcon, MergeIcon } from "./studio-icons";

/* The pieces of "Ready for production", shared by the studio's tab-bar chip
 * (its popover, Merge to main and the merge confirmation) and the project
 * Overview's read-only card. */

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
  const showRepositories = useShowRepositories();
  return (
    <>
      <ul className="qa-promo__rows" aria-label="QA testing">
        <li className="qa-promo__row" data-tone={state.tone}>
          <span className="qa-promo__tick" aria-hidden="true">
            {state.approved ? <CheckIcon /> : <span className="qa-promo__dot" />}
          </span>
          <span className="qa-promo__row-text">
            <span className="qa-promo__name">{data.deliveryProject?.name ?? "Project"} QA testing</span>
            <span className="qa-promo__state">{state.label}</span>
          </span>
          {data.run?.verdict ? <VerdictPill verdict={data.run.verdict} /> : null}
        </li>
        {(showRepositories ? data.repositories : []).map((head) => {
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
    </>
  );
}

function Blocking({ data, id }: Readonly<{ data: QaPromotionStatus; id?: string }>) {
  const showRepositories = useShowRepositories();
  const reasons = showRepositories ? blockingReasons(data) : projectReasons(blockingReasons(data));
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

/** The PR number for everyone, and who merges for those who cannot. Nothing once delivered. */
function CardFoot({ vm, data }: Readonly<{ vm: QaPromotionViewModel; data: QaPromotionStatus }>) {
  const showRepositories = useShowRepositories();
  if (data.iterationDelivered) return null;
  return (
    <div className="qa-promo__foot">
      {showRepositories && data.pullRequest ? <PullRequestRef label={`Promotion PR #${data.pullRequest.number}`} /> : null}
      {showRepositories && !data.pullRequest ? (
        <span className="qa-promo__muted">No promotion pull request is open yet.</span>
      ) : null}
      {vm.canMerge ? null : (
        <span className="qa-promo__muted">
          {data.scope
            ? `Product owners merge ${data.qaBranch} into ${data.targetBranch} once QA signs the Project off Approved.`
            : `Product owners merge ${data.qaBranch} into ${data.targetBranch} once every checklist is approved.`}
        </span>
      )}
    </div>
  );
}

/**
 * Everything the promotion status says below its title: the Project gate
 * (or, on an older backend, each shared checklist), what blocks the merge,
 * and the pull request with who merges it.
 */
export function PromotionDetails({ vm, data }: Readonly<{ vm: QaPromotionViewModel; data: QaPromotionStatus }>) {
  return (
    <>
      {data.scope === "project" ? <ProjectGate data={data} /> : null}
      {/* The deprecated per-checklist list: only an older backend's gate. */}
      {!data.scope && data.checklists.length > 0 ? (
        <ul className="qa-promo__rows" aria-label="Shared checklists on this commit">
          {data.checklists.map((entry) => (
            <ChecklistRow key={entry.id} entry={entry} />
          ))}
        </ul>
      ) : null}
      {data.iterationDelivered ? <p className="qa-promo__delivered">{deliveredNote(data)}</p> : null}
      <Blocking data={data} />
      <CardFoot vm={vm} data={data} />
    </>
  );
}

/** "Merge to main", for Team leads and Admins the server allows; disabled with its reason. */
export function MergeButton({ vm, whyId }: Readonly<{ vm: QaPromotionViewModel; whyId: string }>) {
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

/** The confirmation: the project, the commit and the pull request, named before anything merges. */
export function MergeDialog({
  vm,
  data,
  projectName,
}: Readonly<{ vm: QaPromotionViewModel; data: QaPromotionStatus; projectName: string }>) {
  const showRepositories = useShowRepositories();
  if (!vm.canMerge) return null;
  const pr = data.pullRequest;
  return (
    <FormDialog
      open={vm.mergeState !== "idle"}
      onClose={vm.cancelConfirm}
      portal
      title={showRepositories ? `Merge ${data.qaBranch} into ${data.targetBranch}?` : `Merge ${projectName} into main?`}
      description={showRepositories ? mergeConfirmText(data, projectName) : projectMergeConfirmText(projectName)}
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
        {showRepositories ? (
          <>
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
          </>
        ) : null}
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
