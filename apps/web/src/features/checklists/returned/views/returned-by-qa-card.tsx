"use client";

import "./returned.css";

import type { AppRole } from "@/shared/api/contracts";

import { SeverityBadge } from "../../items";
import { agoLabel, commitLabel, roleCanRequestRetest } from "../../model/qa-run-rules";
import type { QaReturnedItem } from "../../model/qa-run-types";
import {
  useRequestRetestViewModel,
  type RequestRetestViewModel,
} from "../view-models/use-request-retest-view-model";
import { useReturnedItemsViewModel } from "../view-models/use-returned-items-view-model";
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

/**
 * The Overview's "Returned by QA" card: every item QA sent back on this
 * project, with what they found and how to reproduce it. It appears only
 * while there is something to fix. Developers, Team leads and Admins can mark
 * an item fixed and ask QA to re-test it; the list refreshes after.
 */
export function ReturnedByQaCard({
  projectId,
  enabled,
  appRole,
}: Readonly<{ projectId: string; enabled: boolean; appRole: AppRole | null | undefined }>) {
  const list = useReturnedItemsViewModel({ projectId, enabled });
  const retest = useRequestRetestViewModel({ projectId, onDone: list.reload });
  if (!enabled) return null;
  if (list.status === "error") {
    return (
      <div className="qa-returned-error" role="alert">
        <p>{list.error}</p>
        <button type="button" className="ghost-button" onClick={list.reload}>
          Try again
        </button>
      </div>
    );
  }
  if (list.status !== "ready" || list.items.length === 0) return null;
  const canRequest = roleCanRequestRetest(appRole);
  return (
    <section className="qa-returned" aria-labelledby="qa-returned-title">
      <header className="qa-returned__header">
        <h2 className="qa-returned__heading" id="qa-returned-title">
          Returned by QA
          <span className="qa-returned__count">{list.items.length}</span>
        </h2>
        <p className="qa-returned__lede">
          QA sent these back from a verification run. Fix them on the branch, then ask for a re-test.
        </p>
      </header>
      <ul className="qa-returned__list">
        {list.items.map((entry) => (
          <ReturnedRow
            key={`${entry.runId}:${entry.item.id}`}
            entry={entry}
            canRequest={canRequest}
            vm={retest}
          />
        ))}
      </ul>
    </section>
  );
}
