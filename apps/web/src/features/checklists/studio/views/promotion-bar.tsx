"use client";

import "./promotion.css";

import { useId, useRef, type ReactNode } from "react";

import {
  approvedCountLabel,
  PROMOTION_TARGET_BRANCH,
  promotionChip,
  promotionRoute,
  promotionTitle,
} from "../../model/qa-promotion-rules";
import type { QaPromotionStatus } from "../../model/qa-promotion-types";
import { useShowRepositories } from "../view-models/repository-visibility";
import { useDisclosurePopover } from "../view-models/use-disclosure-popover";
import type { PoDeliveryViewModel } from "../view-models/use-po-delivery-view-model";
import type { QaPromotionViewModel } from "../view-models/use-qa-promotion-view-model";
import { MergeAllToMain } from "./po-delivery";
import { PromotionOutcome } from "./promotion-outcome";
import { MergeButton, MergeDialog, PromotionDetails } from "./promotion-parts";
import { ChevronDownIcon } from "./studio-icons";

/* "Ready for production" in the run column's tab bar: a status chip whose
 * popover holds what the old promotion strip showed, "Merge to main" beside
 * it for the viewers the server lets merge, and — under the bar — how the
 * last merge ended. */

type BarProps = Readonly<{ vm: QaPromotionViewModel }>;

/** The popover's head: the verdict, the route and the gate in a line. */
function PopoverHead({ data, headingId }: Readonly<{ data: QaPromotionStatus; headingId: string }>) {
  const showRepositories = useShowRepositories();
  return (
    <div className="qa-promo-pop__head">
      <p className="qa-promo-pop__title" id={headingId}>
        {promotionTitle(data)}
      </p>
      <p className="qa-promo__route">
        {showRepositories ? <code>{promotionRoute(data)}</code> : null}
        <span>{approvedCountLabel(data)}</span>
      </p>
    </div>
  );
}

/** What the popover says: the status, or that it is loading or could not be read. */
function PopoverBody({ vm, headingId }: Readonly<{ vm: QaPromotionViewModel; headingId: string }>) {
  if (vm.data) {
    return (
      <>
        <PopoverHead data={vm.data} headingId={headingId} />
        {vm.canMerge && vm.disabledReason ? <p className="qa-promo__why">{vm.disabledReason}</p> : null}
        <PromotionDetails vm={vm} data={vm.data} />
      </>
    );
  }
  if (vm.status === "loading") {
    return (
      <p className="qa-promo-pop__title" id={headingId}>
        Checking whether uat is ready for {PROMOTION_TARGET_BRANCH}…
      </p>
    );
  }
  return (
    <>
      <p className="qa-promo-pop__title" id={headingId}>
        Production readiness unknown
      </p>
      <p className="qa-promo__muted">{vm.error}</p>
      <button type="button" className="ghost-button qa-promo-pop__retry" onClick={vm.reload}>
        Try again
      </button>
    </>
  );
}

/**
 * The status chip: green when uat is approved for main, amber while it is
 * not, grey while that is being read. It is a disclosure button; its
 * popover is anchored under it and closes on Escape (focus back on the chip),
 * a press outside, or focus moving away. Narrow, the chip shows "Ready" /
 * "Not ready"; its accessible name stays the full sentence.
 */
export function PromotionStatusChip({ vm }: BarProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popover = useDisclosurePopover({ triggerRef, rootRef });
  const panelId = useId();
  const headingId = useId();
  if (vm.status === "unavailable") return null;
  const chip = promotionChip(vm.status, vm.data);
  return (
    <div ref={rootRef} className="qa-promo-status" onKeyDown={popover.onKeyDown} onBlur={popover.onBlur}>
      <button
        ref={triggerRef}
        type="button"
        className="qa-promo-chip"
        data-tone={chip.tone}
        aria-label={chip.label}
        aria-expanded={popover.open}
        aria-controls={panelId}
        onClick={popover.toggle}
      >
        <span className="qa-promo-chip__dot" aria-hidden="true" />
        <span className="qa-promo-chip__full">{chip.label}</span>
        <span className="qa-promo-chip__short">{chip.short}</span>
        <ChevronDownIcon />
      </button>
      <div
        id={panelId}
        className="qa-promo-pop"
        role="group"
        aria-labelledby={headingId}
        aria-busy={vm.refreshing}
        data-tone={chip.tone}
        hidden={!popover.open}
      >
        <PopoverBody vm={vm} headingId={headingId} />
      </div>
    </div>
  );
}

/**
 * "Merge to main", beside the chip, only for viewers the server lets merge.
 * Disabled, it is described by why — text that is always in the page, so
 * the reason is announced whether or not the popover is open.
 */
export function MergeToMain({ vm }: BarProps) {
  const whyId = useId();
  if (!vm.canMerge) return null;
  return (
    <>
      <MergeButton vm={vm} whyId={whyId} />
      {vm.disabledReason ? (
        <span id={whyId} className="sr-only">
          {vm.disabledReason}
        </span>
      ) : null}
    </>
  );
}

/**
 * The tab bar's one merge button. On a Project of two or more repositories
 * the server lets this viewer merge (`delivery.canMergeAll`), Merge to main
 * merges every repository not in main yet — so it stays useful after this
 * repository already reached main. Otherwise it merges this repository's uat.
 */
export function StudioMergeAction({
  promotion,
  delivery,
}: Readonly<{ promotion: QaPromotionViewModel; delivery: PoDeliveryViewModel }>) {
  return delivery.canMergeAll ? <MergeAllToMain vm={delivery} /> : <MergeToMain vm={promotion} />;
}

/**
 * Under the tab bar: how the last merge ended, shown in place until
 * dismissed (a live region, so it is announced) — the viewer just pressed
 * Merge, and the answer belongs in view, not behind the chip. `children` (how
 * a merge of every repository ended) shares that live region. Then the merge
 * confirmation, which is kept out of the bar so nothing there can become its
 * containing block.
 */
export function PromotionBarFoot({
  vm,
  projectName,
  children,
}: Readonly<{ vm: QaPromotionViewModel; projectName: string; children?: ReactNode }>) {
  return (
    <>
      <PromotionOutcome vm={vm} targetBranch={vm.data?.targetBranch ?? PROMOTION_TARGET_BRANCH}>
        {children}
      </PromotionOutcome>
      {vm.data ? <MergeDialog vm={vm} data={vm.data} projectName={projectName} /> : null}
    </>
  );
}
