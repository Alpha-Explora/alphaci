'use client';

import './promotion.css';

import { useId, type ReactNode } from 'react';

import {
  approvedCountLabel,
  promotionRoute,
  promotionTitle,
} from '../../model/qa-promotion-rules';
import type { QaPromotionStatus } from '../../model/qa-promotion-types';
import type { QaPromotionViewModel } from '../view-models/use-qa-promotion-view-model';
import { useDisclosure } from '../view-models/use-remembered-flag';
import { PromotionDetails } from './promotion-parts';
import { ChevronDownIcon, MergeIcon } from './studio-icons';

type CardProps = Readonly<{ vm: QaPromotionViewModel; action?: ReactNode }>;

function CardHead({
  data,
  collapsed,
  onToggle,
  bodyId,
  action,
}: Readonly<{
  data: QaPromotionStatus;
  collapsed: boolean;
  onToggle: () => void;
  bodyId: string;
  action?: ReactNode;
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
      {action}
    </div>
  );
}

/** The card's tone: delivered, ready, or not ready. */
function readyState(data: QaPromotionStatus): 'delivered' | 'true' | 'false' {
  if (data.iterationDelivered) return 'delivered';
  return data.eligible ? 'true' : 'false';
}

function ReadyCard({
  vm,
  data,
  action,
}: Readonly<{
  vm: QaPromotionViewModel;
  data: QaPromotionStatus;
  action?: ReactNode;
}>) {
  // Folded to its head, which already answers "ready or not"; unfolding is
  // for this visit only.
  const [open, toggle] = useDisclosure();
  const bodyId = useId();
  return (
    <section
      className="qa-promo"
      aria-label="Production readiness"
      data-ready={readyState(data)}
      data-collapsed={open ? 'false' : 'true'}
      aria-busy={vm.refreshing}
    >
      <CardHead
        data={data}
        collapsed={!open}
        onToggle={toggle}
        bodyId={bodyId}
        action={action}
      />
      <div id={bodyId} className="qa-promo__body" hidden={!open}>
        <PromotionDetails vm={vm} data={data} />
      </div>
    </section>
  );
}

/**
 * The project Overview's "Ready for production" card: whether uat's current
 * commit is QA-approved for main. Authorized team members can merge here or
 * from their Studio after the same QA and Product Owner gates pass.
 */
export function PromotionCard({ vm, action }: CardProps) {
  if (vm.status === 'unavailable') return null;
  if (vm.status === 'loading')
    return (
      <div className="hier-skeleton qa-promo-skeleton" aria-hidden="true" />
    );
  if (vm.status === 'error' || !vm.data) {
    return (
      <div className="qa-promo-error" role="alert">
        <p>{vm.error}</p>
        <button type="button" className="ghost-button" onClick={vm.reload}>
          Try again
        </button>
      </div>
    );
  }
  return <ReadyCard vm={vm} data={vm.data} action={action} />;
}
