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
} from "../../model/project-run-rules";
import type { MyItemsBucket, ProjectFeedItem } from "../../model/project-run-types";
import { agoLabel } from "../../model/qa-run-rules";
import { canSetProgress, itemProgressEditable, kindCopy } from "../../model/requirement-rules";
import { useItemProgressViewModel, type ItemProgressViewModel } from "../view-models/use-item-progress-view-model";
import {
  useProjectMyItemsViewModel,
  type ProjectMyItemsViewModel,
} from "../view-models/use-project-my-items-view-model";
import { ProgressControl } from "./progress-control";

function Detail({ label, text }: Readonly<{ label: string; text: string | null }>) {
  if (!text) return null;
  return (
    <div className="qa-returned__detail">
      <span className="qa-returned__detail-label">{label}</span>
      <p>{text}</p>
    </div>
  );
}

/** What QA recorded, on a returned item: who, how bad, and how to reproduce it. */
function QaFindings({ entry }: Readonly<{ entry: ProjectFeedItem }>) {
  const runItem = entry.runItem;
  if (!runItem) return null;
  const by = runItem.verifiedBy;
  const ago = agoLabel(runItem.verifiedAt);
  return (
    <>
      {by ? (
        <p className="qa-returned__meta">
          <span>
            Returned by <strong>@{by.login}</strong>
            {ago ? ` · ${ago}` : ""}
          </span>
        </p>
      ) : null}
      <Detail label="QA notes" text={runItem.notes} />
      <Detail label="Reproduction steps" text={runItem.reproductionSteps} />
    </>
  );
}

function FeedRow({
  entry,
  bucket,
  canSet,
  progress,
  onReload,
}: Readonly<{
  entry: ProjectFeedItem;
  bucket: MyItemsBucket;
  canSet: boolean;
  progress: ItemProgressViewModel;
  onReload: () => void;
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
      {bucket === "returned" ? <QaFindings entry={entry} /> : null}
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
}: Readonly<{
  bucket: MyItemsBucket;
  entries: ProjectFeedItem[];
  canSet: boolean;
  progress: ItemProgressViewModel;
  onReload: () => void;
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
  buckets,
  ready,
  canSet,
  progress,
}: Readonly<{
  list: ProjectMyItemsViewModel;
  buckets: ReadonlyArray<MyItemsBucket>;
  ready: boolean;
  canSet: boolean;
  progress: ItemProgressViewModel;
}>) {
  if (!ready) {
    return <p className="qa-mine__lede">Nothing here yet. Items appear once a Product owner writes requirements.</p>;
  }
  return (
    <>
      {buckets.map((bucket) => (
        <Bucket
          key={bucket}
          bucket={bucket}
          entries={list.data[bucket]}
          canSet={canSet}
          progress={progress}
          onReload={list.reload}
        />
      ))}
    </>
  );
}

/** Between a delivered iteration and the next, who the team waits for; otherwise the buckets. */
function CardContent({
  list,
  scope,
  next,
  ready,
  canSet,
  progress,
}: Readonly<{
  list: ProjectMyItemsViewModel;
  scope: CardScope;
  next: StartIterationViewModel;
  ready: boolean;
  canSet: boolean;
  progress: ItemProgressViewModel;
}>) {
  if (scope.iterationStep && next.step.kind !== "none") return <IterationNextStepView vm={next} />;
  return <Buckets list={list} buckets={scope.buckets} ready={ready} canSet={canSet} progress={progress} />;
}

/** The whole list, or (`returnedOnly`) just what QA sent back, as the Developer's checklist shows it. */
interface CardScope {
  buckets: ReadonlyArray<MyItemsBucket>;
  /** Only the whole list stands in for who the team waits for; the checklist says that itself. */
  iterationStep: boolean;
  /** Only what was sent back: nothing to show is shown as nothing. */
  hideWhenEmpty: boolean;
  title: string;
  lede: string;
}

const RETURNED_ONLY_BUCKETS: ReadonlyArray<MyItemsBucket> = ["returned"];

function cardScope(returnedOnly: boolean, hideWhenEmpty: boolean): CardScope {
  if (returnedOnly) {
    return {
      buckets: RETURNED_ONLY_BUCKETS,
      iterationStep: false,
      hideWhenEmpty: true,
      title: "Returned by QA",
      lede: "What QA sent back, with its notes. Move each item on again once it is fixed.",
    };
  }
  return {
    buckets: MY_ITEMS_BUCKETS,
    iterationStep: true,
    hideWhenEmpty,
    title: "Progress",
    lede: "Where every story stands: to do, in progress, sent back by QA, and ready for QA testing.",
  };
}

function scopeCount(scope: CardScope, data: ProjectMyItemsViewModel["data"]): number {
  return scope.buckets.reduce((sum, bucket) => sum + data[bucket].length, 0);
}

/** What the card knows once its list and the iteration step are read. */
function cardFacts(scope: CardScope, list: ProjectMyItemsViewModel, next: StartIterationViewModel, enabled: boolean) {
  const waiting = scope.iterationStep && next.step.kind !== "none";
  const total = scopeCount(scope, list.data);
  const ready = list.status === "ready" && total > 0;
  return { waiting, total, ready, state: cardState(enabled, list.status, ready || waiting, scope.hideWhenEmpty) };
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
 * Progress control for Developers, Product owners and admins. The QA Team
 * reads the same list; "Ready for QA" is their queue.
 *
 * `hideWhenEmpty` keeps the repository Overview quiet when there is nothing
 * to do; the Project page shows an empty state instead. `fallback` renders
 * when the server has no project-wide list (an older backend). Between a
 * delivered iteration and the next, the buckets give way to who the team is
 * waiting for (or, for a Product owner or admin, Start iteration N+1).
 *
 * `returnedOnly` is the Developer's checklist's own strip: only what QA
 * sent back, with its findings, and nothing at all when there is none.
 */
export function ProjectMyItemsCard({
  deliveryProjectId,
  enabled,
  appRole,
  hideWhenEmpty = false,
  highlightRequested = false,
  fallback = null,
  returnedOnly = false,
}: Readonly<{
  deliveryProjectId: string;
  enabled: boolean;
  appRole: AppRole | null | undefined;
  hideWhenEmpty?: boolean;
  highlightRequested?: boolean;
  fallback?: ReactNode;
  returnedOnly?: boolean;
}>) {
  const scope = cardScope(returnedOnly, hideWhenEmpty);
  const list = useProjectMyItemsViewModel({ deliveryProjectId, enabled });
  const progress = useItemProgressViewModel({ onSaved: list.applyItem });
  const next = useNextIterationViewModel({ deliveryProjectId, enabled: enabled && scope.iterationStep, appRole });
  const { waiting, total, ready, state } = cardFacts(scope, list, next, enabled);
  const canSet = canSetProgress(appRole);
  const headingRef = useFocusWhenReady(highlightRequested, ready);

  if (state !== "list") return <CardPlaceholder state={state} list={list} fallback={fallback} />;
  return (
    <section
      className={`qa-returned qa-mine${highlightRequested ? " qa-mine--focused" : ""}`}
      data-tone={list.data.returned.length > 0 ? "returned" : "checks"}
      aria-labelledby="pmi-title"
    >
      <header className="qa-returned__header">
        <h2 ref={headingRef} tabIndex={-1} className="qa-returned__heading" id="pmi-title">
          {scope.title}
          {waiting ? null : <span className="qa-mine__count">{total}</span>}
        </h2>
        <p className="qa-mine__lede">{scope.lede}</p>
      </header>
      <CardContent list={list} scope={scope} next={next} ready={ready} canSet={canSet} progress={progress} />
    </section>
  );
}
