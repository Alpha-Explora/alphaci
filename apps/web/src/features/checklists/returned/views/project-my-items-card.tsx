"use client";

import "./returned.css";
import "./progress.css";

import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";

import type { AppRole } from "@/shared/api/contracts";

import { IterationNextStepView, useNextIterationViewModel, type StartIterationViewModel } from "../../iteration";
import { SeverityBadge, StatusPill } from "../../items";
import {
  bucketCopy,
  feedItemKey,
  MY_ITEMS_BUCKETS,
  projectMyItemsCount,
} from "../../model/project-run-rules";
import type { MyItemsBucket, ProjectFeedItem } from "../../model/project-run-types";
import { canSetProgress, itemProgressEditable, kindCopy } from "../../model/requirement-rules";
import { useItemProgressViewModel, type ItemProgressViewModel } from "../view-models/use-item-progress-view-model";
import {
  useProjectMyItemsViewModel,
  type ProjectMyItemsViewModel,
} from "../view-models/use-project-my-items-view-model";
import { FixProof } from "./fix-proof";
import { ProgressControl } from "./progress-control";
import { QaFindings } from "./qa-findings";

function Detail({ label, text }: Readonly<{ label: string; text: string | null }>) {
  if (!text) return null;
  return (
    <div className="qa-returned__detail">
      <span className="qa-returned__detail-label">{label}</span>
      <p>{text}</p>
    </div>
  );
}

function FeedRow({
  entry,
  bucket,
  canSet,
  progress,
  onReload,
  deliveryProjectId,
}: Readonly<{
  entry: ProjectFeedItem;
  bucket: MyItemsBucket;
  canSet: boolean;
  progress: ItemProgressViewModel;
  onReload: () => void;
  deliveryProjectId: string;
}>) {
  const { item, requirement, runItem } = entry;
  return (
    <li className="qa-returned__row">
      <div className="qa-returned__head">
        <span className="qa-returned__title">{item.title}</span>
        <span className="pmi-states">
          {runItem?.defectSeverity && bucket === "returned" ? <SeverityBadge severity={runItem.defectSeverity} /> : null}
          {runItem ? <StatusPill status={runItem.status} /> : null}
        </span>
      </div>
      <p className="qa-returned__meta">
        <span>{kindCopy(requirement.kind).singular}</span>
        <span>{requirement.name}</span>
      </p>
      <Detail label="Acceptance criteria" text={item.acceptanceCriteria} />
      {bucket === "returned" ? <QaFindings runItem={runItem} /> : null}
      <ProgressControl
        item={item}
        editable={itemProgressEditable(item, canSet)}
        vm={progress}
        onReload={onReload}
      />
    </li>
  );
}

function Bucket({
  bucket,
  entries,
  canSet,
  progress,
  onReload,
  deliveryProjectId,
}: Readonly<{
  bucket: MyItemsBucket;
  entries: ProjectFeedItem[];
  canSet: boolean;
  progress: ItemProgressViewModel;
  onReload: () => void;
  deliveryProjectId: string;
}>) {
  if (entries.length === 0) return null;
  const copy = bucketCopy(bucket);
  const titleId = `pmi-${bucket}`;
  return (
    <section className="qa-mine__section" aria-labelledby={titleId} data-bucket={bucket}>
      <h3 className="qa-mine__section-title" id={titleId}>
        {copy.title}
        <span className={bucket === "returned" ? "qa-returned__count" : "qa-mine__count"}>{entries.length}</span>
      </h3>
      <p className="qa-mine__lede">{copy.lede}</p>
      <ul className="qa-returned__list">
        {entries.map((entry) => (
          <FeedRow
            key={feedItemKey(entry)}
            entry={entry}
            bucket={bucket}
            canSet={canSet}
            progress={progress}
            onReload={onReload}
            deliveryProjectId={deliveryProjectId}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * A notification deep link asks the card to scroll into view and take focus
 * once it has something to show — once, whatever re-renders after.
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

function CardPlaceholder({
  state,
  list,
  fallback,
}: Readonly<{ state: Exclude<CardState, "list">; list: ProjectMyItemsViewModel; fallback: ReactNode }>) {
  if (state === "fallback") return <>{fallback}</>;
  if (state === "loading") return <div className="hier-skeleton pmi-skeleton" aria-hidden="true" />;
  if (state === "hidden") return null;
  return (
    <div className="qa-returned-error" role="alert">
      <p>{list.error}</p>
      <button type="button" className="ghost-button" onClick={list.reload}>
        Try again
      </button>
    </div>
  );
}

function Buckets({
  list,
  ready,
  canSet,
  progress,
  deliveryProjectId,
}: Readonly<{
  list: ProjectMyItemsViewModel;
  ready: boolean;
  canSet: boolean;
  progress: ItemProgressViewModel;
  deliveryProjectId: string;
}>) {
  if (!ready) {
    return <p className="qa-mine__lede">Nothing here yet. Items appear once a Product owner writes requirements.</p>;
  }
  return (
    <>
      {MY_ITEMS_BUCKETS.map((bucket) => (
        <Bucket
          key={bucket}
          bucket={bucket}
          entries={list.data[bucket]}
          canSet={canSet}
          progress={progress}
          onReload={list.reload}
          deliveryProjectId={deliveryProjectId}
        />
      ))}
    </>
  );
}

/** Between a delivered iteration and the next, who the team waits for; otherwise the buckets. */
function CardContent({
  list,
  next,
  ready,
  canSet,
  progress,
}: Readonly<{
  list: ProjectMyItemsViewModel;
  next: StartIterationViewModel;
  ready: boolean;
  canSet: boolean;
  progress: ItemProgressViewModel;
}>) {
  if (next.step.kind !== "none") return <IterationNextStepView vm={next} />;
  return <Buckets list={list} ready={ready} canSet={canSet} progress={progress} />;
}

type CardState = "hidden" | "fallback" | "loading" | "error" | "list";

/** Which face the card shows: nothing, the older card, a skeleton, an error, or the list. */
function cardState(
  enabled: boolean,
  status: ProjectMyItemsViewModel["status"],
  ready: boolean,
  hideWhenEmpty: boolean,
): CardState {
  if (!enabled || status === "idle") return "hidden";
  if (status === "unavailable") return "fallback";
  if (status === "error") return "error";
  if (status === "loading") return hideWhenEmpty ? "hidden" : "loading";
  return !ready && hideWhenEmpty ? "hidden" : "list";
}

/**
 * "My QA items" for a whole Project: every Developer's items, in four
 * buckets (returned by QA, in progress, to do, ready for QA), with the
 * Progress control for Developers, Product owners and admins, and "Proof of
 * the fix" where the server lets a Developer attach screenshots of it. The QA Team
 * reads the same list; "Ready for QA" is their queue.
 *
 * `hideWhenEmpty` keeps the repository Overview quiet when there is nothing
 * to do; the Project page shows an empty state instead. `fallback` renders
 * when the server has no project-wide list (an older backend). Between a
 * delivered iteration and the next, the buckets give way to who the team is
 * waiting for (or, for a Product owner or admin, Start iteration N+1).
 */
export function ProjectMyItemsCard({
  deliveryProjectId,
  enabled,
  appRole,
  hideWhenEmpty = false,
  highlightRequested = false,
  fallback = null,
}: Readonly<{
  deliveryProjectId: string;
  enabled: boolean;
  appRole: AppRole | null | undefined;
  hideWhenEmpty?: boolean;
  highlightRequested?: boolean;
  fallback?: ReactNode;
}>) {
  const list = useProjectMyItemsViewModel({ deliveryProjectId, enabled });
  const progress = useItemProgressViewModel({ onSaved: list.applyItem });
  const next = useNextIterationViewModel({ deliveryProjectId, enabled, appRole });
  const waiting = next.step.kind !== "none";
  const total = projectMyItemsCount(list.data);
  const ready = list.status === "ready" && total > 0;
  const canSet = canSetProgress(appRole);
  const headingRef = useFocusWhenReady(highlightRequested, ready);

  const state = cardState(enabled, list.status, ready || waiting, hideWhenEmpty);
  if (state !== "list") return <CardPlaceholder state={state} list={list} fallback={fallback} />;
  return (
    <section
      className={`qa-returned qa-mine${highlightRequested ? " qa-mine--focused" : ""}`}
      data-tone={list.data.returned.length > 0 ? "returned" : "checks"}
      aria-labelledby="pmi-title"
    >
      <header className="qa-returned__header">
        <h2 ref={headingRef} tabIndex={-1} className="qa-returned__heading" id="pmi-title">
          Progress
          {waiting ? null : <span className="qa-mine__count">{total}</span>}
        </h2>
        <p className="qa-mine__lede">Where every story stands: to do, in progress, sent back by QA, and ready for QA testing.</p>
      </header>
      <CardContent list={list} next={next} ready={ready} canSet={canSet} progress={progress} />
    </section>
  );
}
