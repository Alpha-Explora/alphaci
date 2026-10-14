"use client";

import "./promotion.css";

import { useId } from "react";

import { approvedCountLabel, promotionRoute, promotionTitle } from "../../model/qa-promotion-rules";
import type { QaPromotionStatus } from "../../model/qa-promotion-types";
import type { QaPromotionViewModel } from "../view-models/use-qa-promotion-view-model";
import { useDisclosure } from "../view-models/use-remembered-flag";
import { PromotionDetails } from "./promotion-parts";
import { ChevronDownIcon, MergeIcon } from "./studio-icons";

type CardProps = Readonly<{ vm: QaPromotionViewModel }>;

function CardHead({
  data,
  collapsed,
  onToggle,
  bodyId,
}: Readonly<{ data: QaPromotionStatus; collapsed: boolean; onToggle: () => void; bodyId: string }>) {
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
    </div>
  );
}

function ReadyCard({ vm, data }: Readonly<{ vm: QaPromotionViewModel; data: QaPromotionStatus }>) {
  // Folded to its head, which already answers "ready or not"; unfolding is
  // for this visit only.
  const [open, toggle] = useDisclosure();
  const bodyId = useId();
  return (
    <section
      className="qa-promo"
      aria-label="Production readiness"
      data-ready={data.eligible ? "true" : "false"}
      data-collapsed={open ? "false" : "true"}
      aria-busy={vm.refreshing}
    >
      <CardHead data={data} collapsed={!open} onToggle={toggle} bodyId={bodyId} />
      <div id={bodyId} className="qa-promo__body" hidden={!open}>
        <PromotionDetails vm={vm} data={data} />
      </div>
    </section>
  );
}

/**
 * The project Overview's "Ready for production" card: whether uat's current
 * commit is QA-approved for main, read-only. Merging happens in QA Studio and
 * PO Studio, from the status chip in their run column's tab bar.
 */
export function PromotionCard({ vm }: CardProps) {
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
  return <ReadyCard vm={vm} data={vm.data} />;
}
