"use client";

import "./automation.css";

import { AutomatedBadge } from "../../items";
import {
  AUTOMATED_DIFFERS_HINT,
  UNCONFIRMED_PASS_HINT,
  automatedDiffers,
  automatedSentence,
  automatedSourceLabel,
  automatedStatusTone,
  isUnconfirmedPass,
  itemScopeLabel,
  stageName,
  stageResultFor,
  unlinkedStageNote,
} from "../../model/qa-automation-rules";
import type { QaAutomatedItemResult, QaRunAutomationResult } from "../../model/qa-automation-types";
import { agoLabel } from "../../model/qa-run-rules";
import type { QaRunItemStatus } from "../../model/qa-run-types";
import { InfoIcon } from "./studio-icons";

export interface ItemAutomationContext {
  result: QaAutomatedItemResult;
  automation: QaRunAutomationResult;
  commitSha: string | null;
}

function sentenceOf({ result, automation, commitSha }: ItemAutomationContext): string {
  return automatedSentence(result, { commitSha, stageResult: stageResultFor(automation, result.stage) });
}

/**
 * The Automated badge as a disclosure button: hover shows the sentence,
 * activating it opens the details below the item. It sits beside the manual
 * status pill and never changes it.
 */
export function AutomatedToggle({
  context,
  open,
  controls,
  onToggle,
}: Readonly<{ context: ItemAutomationContext; open: boolean; controls: string; onToggle: () => void }>) {
  return (
    <button
      type="button"
      className="qa-auto-toggle"
      aria-expanded={open}
      aria-controls={controls}
      title={
        isUnconfirmedPass(context.result)
          ? `${sentenceOf(context)}. ${UNCONFIRMED_PASS_HINT}`
          : sentenceOf(context)
      }
      onClick={onToggle}
    >
      <AutomatedBadge status={context.result.status} inferred={context.result.inferred} />
      <span className="sr-only">{open ? " — hide details" : " — show details"}</span>
    </button>
  );
}

/** "Playwright E2E · This spec · Verify stage · 3m ago". */
function metaLine(result: QaAutomatedItemResult): string {
  return [
    automatedSourceLabel(result.source),
    itemScopeLabel(result),
    result.stage ? `${stageName(result.stage)} stage` : null,
    result.reportedAt ? `reported ${agoLabel(result.reportedAt)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The expanded details: the sentence, where it came from, and the matched failure. */
export function AutomatedDetails({
  id,
  context,
  hidden,
}: Readonly<{ id: string; context: ItemAutomationContext; hidden: boolean }>) {
  const { result } = context;
  const failure = result.status === "failed" ? result.failure : null;
  const stageNote = unlinkedStageNote(result, stageResultFor(context.automation, result.stage));
  return (
    <div id={id} hidden={hidden} className={`qa-auto-detail qa-auto-detail--${automatedStatusTone(result.status)}`}>
      <p className="qa-auto-detail__sentence">{sentenceOf(context)}</p>
      {isUnconfirmedPass(result) ? <p className="qa-auto-detail__meta">{UNCONFIRMED_PASS_HINT}</p> : null}
      {stageNote ? <p className="qa-auto-detail__meta">{stageNote}</p> : null}
      <p className="qa-auto-detail__meta">{metaLine(result)}</p>
      {failure ? (
        <div className="qa-auto-detail__failure">
          <code className="qa-auto-detail__name">{failure.name}</code>
          {failure.message ? <p className="qa-auto-detail__message">{failure.message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** A quiet note, never a prompt: the recorded status is the tester's call. */
export function AutomatedDiffersHint({
  recorded,
  result,
}: Readonly<{ recorded: QaRunItemStatus; result: QaAutomatedItemResult }>) {
  if (!automatedDiffers(recorded, result.status)) return null;
  return (
    <p className="qa-auto-hint">
      <InfoIcon />
      {AUTOMATED_DIFFERS_HINT}
    </p>
  );
}
