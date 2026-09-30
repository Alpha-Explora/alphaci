"use client";

import "./returned.css";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

import type { AppRole } from "@/shared/api/contracts";

import { SeverityBadge } from "../../items";
import { groupByCommit, myItemKey, myItemsCount } from "../../model/qa-my-items-rules";
import { agoLabel, commitLabel, roleCanRequestRetest } from "../../model/qa-run-rules";
import type { QaDeveloperItem, QaReturnedItem } from "../../model/qa-run-types";
import {
  useDeveloperItemEditorViewModel,
  type DeveloperItemEditorViewModel,
} from "../view-models/use-developer-item-editor-view-model";
import { useMyQaItemsViewModel } from "../view-models/use-my-qa-items-view-model";
import {
  useRequestRetestViewModel,
  type RequestRetestViewModel,
} from "../view-models/use-request-retest-view-model";
import { DeveloperItemRow } from "./developer-item-row";
import { RetestForm } from "./retest-form";

function Detail({ label, text }: Readonly<{ label: string; text: string | null }>) {
  if (!text) return null;
  return (
    <div className="qa-returned__detail">
      <span className="qa-returned__detail-label">{label}</span>
      <p>{text}</p>
    </div>
  );
}

function ReturnedBy({ entry }: Readonly<{ entry: QaReturnedItem }>) {
  const by = entry.item.verifiedBy;
  if (!by) return null;
  const ago = agoLabel(entry.item.verifiedAt);
  return (
    <span>
      Returned by <strong>@{by.login}</strong>
      {ago ? ` · ${ago}` : ""}
    </span>
  );
}

function FixState({
  entry,
  canRequest,
  vm,
}: Readonly<{ entry: QaReturnedItem; canRequest: boolean; vm: RequestRetestViewModel }>) {
  // Status decides, not the presence of a fix request: an item QA returned
  // again is actionable even if an earlier round was marked fixed.
  if (canRequest && entry.item.status === "returned_to_dev") {
    return (
      <RetestForm
        vm={vm}
        target={{ runId: entry.runId, itemId: entry.item.id }}
        itemTitle={entry.item.title}
      />
    );
  }
  const fix = entry.item.fixRequest;
  if (fix) {
    const ago = agoLabel(fix.requestedAt);
    return (
      <p className="qa-returned__requested">
        Re-test requested by <strong>@{fix.requestedBy.login}</strong>
        {ago ? ` · ${ago}` : ""}
        {fix.note ? <span className="qa-returned__requested-note">“{fix.note}”</span> : null}
      </p>
    );
  }
  return null;
}

function ReturnedRow({
  entry,
  canRequest,
  vm,
}: Readonly<{ entry: QaReturnedItem; canRequest: boolean; vm: RequestRetestViewModel }>) {
  const { item } = entry;
  return (
    <li className="qa-returned__row">
      <div className="qa-returned__head">
        <span className="qa-returned__title">{item.title}</span>
        {item.defectSeverity ? <SeverityBadge severity={item.defectSeverity} /> : null}
      </div>
      <p className="qa-returned__meta">
        <code>{commitLabel(entry.branch, entry.commitSha)}</code>
        <span>{entry.checklistName}</span>
        <ReturnedBy entry={entry} />
      </p>
      <Detail label="Notes" text={item.notes} />
      <Detail label="Reproduction steps" text={item.reproductionSteps} />
      <FixState entry={entry} canRequest={canRequest} vm={vm} />
    </li>
  );
}

/** Section 1: what QA sent back, with "Mark fixed & request re-test". */
function ReturnedSection({
  items,
  canRequest,
  vm,
}: Readonly<{ items: QaReturnedItem[]; canRequest: boolean; vm: RequestRetestViewModel }>) {
  if (items.length === 0) return null;
  return (
    <section className="qa-mine__section" aria-labelledby="qa-mine-returned">
      <h3 className="qa-mine__section-title" id="qa-mine-returned">
        Returned by QA
        <span className="qa-returned__count">{items.length}</span>
      </h3>
      <p className="qa-mine__lede">
        QA sent these back from a verification run. Fix them on the branch, then ask for a re-test.
      </p>
      <ul className="qa-returned__list">
        {items.map((entry) => (
          <ReturnedRow key={myItemKey(entry)} entry={entry} canRequest={canRequest} vm={vm} />
        ))}
      </ul>
    </section>
  );
}

/** Section 2: the current uat run's developer items, one group per commit. */
function DeveloperSection({
  items,
  vm,
  onReload,
}: Readonly<{ items: QaDeveloperItem[]; vm: DeveloperItemEditorViewModel; onReload: () => void }>) {
  if (items.length === 0) return null;
  return (
    <>
      {groupByCommit(items).map((group) => (
        <section key={group.key} className="qa-mine__section" aria-label={`Your checks on ${group.label}`}>
          <h3 className="qa-mine__section-title">
            Your checks on <code>{group.label}</code>
            <span className="qa-mine__count">{group.entries.length}</span>
          </h3>
          <p className="qa-mine__lede">
            The checklist gives these to developers. Record what you verified; QA sees it in QA Studio.
          </p>
          <ul className="qa-mine__list">
            {group.entries.map((entry) => (
              <DeveloperItemRow key={myItemKey(entry)} entry={entry} vm={vm} onReload={onReload} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function LoadError({ message, onRetry }: Readonly<{ message: string | null; onRetry: () => void }>) {
  return (
    <div className="qa-returned-error" role="alert">
      <p>{message}</p>
      <button type="button" className="ghost-button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

/**
 * The Overview's "My QA items" card: what QA returned on this project (with
 * "Mark fixed & request re-test"), and the current uat run's developer items
 * with the same status control QA Studio uses. It appears only while there is
 * something in either list; the server decides who may change each item.
 */
export function MyQaItemsCard({
  projectId,
  enabled,
  appRole,
  highlightRequested = false,
}: Readonly<{
  projectId: string;
  enabled: boolean;
  appRole: AppRole | null | undefined;
  /** A notification deep-link (spec §8.6, `?focus=my-qa-items`) asking this
   * card to scroll into view and briefly highlight itself once it has
   * something to show. */
  highlightRequested?: boolean;
}>) {
  const list = useMyQaItemsViewModel({ projectId, enabled });
  const retest = useRequestRetestViewModel({ projectId, onDone: list.reload });
  const editor = useDeveloperItemEditorViewModel({ projectId, onRun: list.applyRun });
  const total = myItemsCount(list.data);
  const ready = list.status === "ready" && total > 0;
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const highlightedOnce = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  // Runs once, only after the card has real content to focus. Guarded by a
  // ref rather than clearing `highlightRequested` so an unrelated re-render
  // (a re-test submitted, a reload) can never replay the scroll/focus.
  useEffect(() => {
    if (!highlightRequested || !ready || highlightedOnce.current) return;
    const node = headingRef.current;
    if (!node) return;
    highlightedOnce.current = true;
    node.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
    node.focus({ preventScroll: true });
  }, [highlightRequested, ready, prefersReducedMotion]);

  if (!enabled) return null;
  if (list.status === "error") return <LoadError message={list.error} onRetry={list.reload} />;
  if (!ready) return null;
  return (
    <section
      className={`qa-returned qa-mine${highlightRequested ? " qa-mine--focused" : ""}`}
      data-tone={list.data.returned.length > 0 ? "returned" : "checks"}
      aria-labelledby="qa-mine-title"
    >
      <header className="qa-returned__header">
        <h2 ref={headingRef} tabIndex={-1} className="qa-returned__heading" id="qa-mine-title">
          My QA items
          <span className="qa-mine__count">{total}</span>
        </h2>
      </header>
      <ReturnedSection items={list.data.returned} canRequest={roleCanRequestRetest(appRole)} vm={retest} />
      <DeveloperSection items={list.data.developerItems} vm={editor} onReload={list.reload} />
    </section>
  );
}
