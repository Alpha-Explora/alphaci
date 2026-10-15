"use client";

import "./returned.css";
import "./summary.css";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

import { IterationWaitingNotice } from "../../iteration";
import { summaryChipLabel } from "../../model/my-qa-items-summary-rules";
import { MY_ITEMS_BUCKETS } from "../../model/project-run-rules";
import { REPOSITORY_SCOPE, type QaScope } from "../../model/qa-scope";
import {
  useMyQaItemsSummaryViewModel,
  type MyQaItemsSummaryViewModel,
} from "../view-models/use-my-qa-items-summary-view-model";

/**
 * A notification deep link asks the summary to scroll into view and take
 * focus once it has something to show: once, whatever re-renders after.
 */
function useFocusWhenReady(requested: boolean, ready: boolean) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const done = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  useEffect(() => {
    if (!requested || !ready || done.current) return;
    const node = headingRef.current;
    if (!node) return;
    done.current = true;
    node.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
    node.focus({ preventScroll: true });
  }, [requested, ready, prefersReducedMotion]);
  return headingRef;
}

function SummaryChips({ vm }: Readonly<{ vm: MyQaItemsSummaryViewModel }>) {
  return (
    <ul className="qa-summary__chips" aria-label="Progress by state">
      {MY_ITEMS_BUCKETS.map((bucket) => (
        <li
          key={bucket}
          className="qa-summary__chip"
          data-bucket={bucket}
          data-empty={vm.counts[bucket] === 0 ? "true" : undefined}
        >
          <span className="qa-summary__chip-count">{vm.counts[bucket]}</span>
          <span className="qa-summary__chip-label">{summaryChipLabel(bucket)}</span>
        </li>
      ))}
    </ul>
  );
}

function OpenChecklist({
  vm,
  onOpenChecklists,
}: Readonly<{ vm: MyQaItemsSummaryViewModel; onOpenChecklists: () => void }>) {
  if (vm.destination.kind === "project") {
    return (
      <Link className="ghost-button qa-summary__open" href={vm.destination.href}>
        Open progress
      </Link>
    );
  }
  return (
    <button type="button" className="ghost-button qa-summary__open" onClick={onOpenChecklists}>
      Open progress
    </button>
  );
}

/**
 * The repository Overview's "My QA items": only how many items sit in each
 * state (Returned, In progress, To do, Ready for QA) and a way to the full
 * list — the Project's "My QA items" for a repository filed under a Project,
 * this repository's Checklists tab otherwise. No per-item rows or controls
 * here. It appears only while there is something to count, or, between a
 * delivered iteration and the next, to say who the team is waiting for.
 */
export function MyQaItemsSummary({
  projectId,
  enabled,
  qaScope = REPOSITORY_SCOPE,
  highlightRequested = false,
  onOpenChecklists,
}: Readonly<{
  projectId: string;
  enabled: boolean;
  qaScope?: QaScope;
  /** `?focus=my-qa-items` (a notification deep link): scroll here and highlight once. */
  highlightRequested?: boolean;
  /** Switch this page to its Checklists tab. */
  onOpenChecklists: () => void;
}>) {
  const vm = useMyQaItemsSummaryViewModel({ projectId, enabled, qaScope });
  const headingRef = useFocusWhenReady(highlightRequested, vm.status === "ready");

  if (vm.status === "hidden") return null;
  if (vm.status === "error") {
    return (
      <div className="qa-returned-error" role="alert">
        <p>{vm.error}</p>
        <button type="button" className="ghost-button" onClick={vm.reload}>
          Try again
        </button>
      </div>
    );
  }
  return (
    <section
      className={`qa-returned qa-mine qa-summary${highlightRequested ? " qa-mine--focused" : ""}`}
      data-tone={vm.counts.returned > 0 ? "returned" : "checks"}
      aria-labelledby="qa-summary-title"
      data-testid="my-qa-items-summary"
    >
      <div className="qa-summary__head">
        <h2 ref={headingRef} tabIndex={-1} className="qa-returned__heading" id="qa-summary-title">
          Progress
          {vm.waiting ? null : <span className="qa-mine__count">{vm.total}</span>}
        </h2>
        <OpenChecklist vm={vm} onOpenChecklists={onOpenChecklists} />
      </div>
      {vm.waiting ? <IterationWaitingNotice text={vm.waiting} /> : <SummaryChips vm={vm} />}
    </section>
  );
}
