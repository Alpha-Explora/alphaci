"use client";

import "./returned.css";

import { agoLabel } from "../../model/qa-run-rules";
import type { ProjectQaRunItem } from "../../model/project-run-types";

function Detail({ label, text }: Readonly<{ label: string; text: string | null }>) {
  if (!text) return null;
  return (
    <div className="qa-returned__detail">
      <span className="qa-returned__detail-label">{label}</span>
      <p>{text}</p>
    </div>
  );
}

const VERDICT_VERBS: Partial<Record<ProjectQaRunItem["status"], string>> = {
  returned_to_dev: "Returned",
  failed: "Failed",
  blocked: "Blocked",
};

/** Whether QA left something a Developer acts on: it sent the item back, failed it or blocked it. */
export function hasQaFindings(runItem: ProjectQaRunItem | null | undefined): runItem is ProjectQaRunItem {
  return Boolean(runItem && VERDICT_VERBS[runItem.status]);
}

/**
 * What QA recorded on an item it sent back, failed or blocked: who and when,
 * its notes, and how to reproduce it. Nothing for any other verdict.
 */
export function QaFindings({ runItem }: Readonly<{ runItem: ProjectQaRunItem | null | undefined }>) {
  if (!hasQaFindings(runItem)) return null;
  const by = runItem.verifiedBy;
  const ago = agoLabel(runItem.verifiedAt);
  return (
    <>
      {by ? (
        <p className="qa-returned__meta">
          <span>
            {VERDICT_VERBS[runItem.status]} by <strong>@{by.login}</strong>
            {ago ? ` · ${ago}` : ""}
          </span>
        </p>
      ) : null}
      <Detail label="QA notes" text={runItem.notes} />
      <Detail label="Reproduction steps" text={runItem.reproductionSteps} />
    </>
  );
}
