"use client";

import { FormDialog } from "@/features/groups/workspace";

import { VerdictPill } from "../../items";
import {
  agoLabel,
  blockersLabel,
  itemStatusLabel,
  openDefectsLabel,
  passedLabel,
  REOPEN_CONFIRM,
  statusSegments,
  verdictLabel,
  verdictTone,
} from "../../model/qa-run-rules";
import type { QaRun, QaVerdict } from "../../model/qa-run-types";
import type { QaReopenViewModel } from "../view-models/use-qa-reopen-view-model";
import type { QaSignoffViewModel } from "../view-models/use-qa-signoff-view-model";
import { SealIcon } from "./studio-icons";

/* ── Summary ─────────────────────────────────────────────────────────────── */

function segmentsLabel(run: Pick<QaRun, "summary">): string {
  return statusSegments(run)
    .map((segment) => `${segment.count} ${itemStatusLabel(segment.status).toLowerCase()}`)
    .join(", ");
}

/** Passed out of total, the run's mix as one bar, and what is still open. */
/**
 * The open defects and blockers under the bar. Inline, only those there are
 * (none at all when both are zero); in a card, both always.
 */
function SummaryFacts({ summary, inline }: Readonly<{ summary: QaRun["summary"]; inline: boolean }>) {
  const { openDefects, blockers } = summary;
  const facts = [
    { shown: !inline || openDefects > 0, tone: openDefects > 0 ? "qa-summary__fact--warn" : undefined, label: openDefectsLabel(openDefects) },
    { shown: !inline || blockers > 0, tone: blockers > 0 ? "qa-summary__fact--danger" : undefined, label: blockersLabel(blockers) },
  ].filter((fact) => fact.shown);
  if (facts.length === 0) return null;
  return (
    <ul className="qa-summary__facts">
      {facts.map((fact) => (
        <li key={fact.label} className={fact.tone}>
          {fact.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * The run's progress: passed of total, a bar of every status, and the open
 * defects and blockers. `card` is its own box in the run; `inline` sits at
 * the end of the column's first row (QA Studio), so its facts appear only
 * once there is something to flag.
 */
export function RunSummary({
  run,
  variant = "card",
}: Readonly<{ run: Pick<QaRun, "summary">; variant?: "card" | "inline" }>) {
  const segments = statusSegments(run);
  const inline = variant === "inline";
  return (
    <div className={inline ? "qa-summary qa-summary--inline" : "qa-summary"}>
      <p className="qa-summary__score">
        <span className="qa-summary__passed">{run.summary.byStatus.passed ?? 0}</span>
        <span className="qa-summary__total">/{run.summary.total} passed</span>
        <span className="sr-only">{passedLabel(run)}</span>
      </p>
      <div
        className="qa-summary__bar"
        role="img"
        aria-label={segments.length > 0 ? segmentsLabel(run) : "No items"}
      >
        {segments.map((segment) => (
          <span
            key={segment.status}
            className={`qa-summary__segment qa-summary__segment--${segment.status}`}
            style={{ flexGrow: segment.count }}
          />
        ))}
      </div>
      <SummaryFacts summary={run.summary} inline={inline} />
    </div>
  );
}

/* ── Signed-off banner ───────────────────────────────────────────────────── */

export function SignoffBanner({
  run,
  subject,
  reopen,
}: Readonly<{
  run: Pick<QaRun, "status" | "signoff">;
  /** What was signed off: "uat @ 9f8e7d6", or the Project's repositories. */
  subject: string;
  reopen: QaReopenViewModel;
}>) {
  const signoff = run.signoff;
  if (run.status !== "signed_off" || !signoff) return null;
  const ago = agoLabel(signoff.signedAt);
  return (
    <>
      <div className={`qa-signoff-banner qa-signoff-banner--${verdictTone(signoff.verdict)}`}>
        <span className="qa-signoff-banner__seal" aria-hidden="true">
          <SealIcon />
        </span>
        <div className="qa-signoff-banner__body">
          <p className="qa-signoff-banner__title">
            Signed off <VerdictPill verdict={signoff.verdict} />
          </p>
          <p className="qa-signoff-banner__meta">
            by <strong>@{signoff.signedBy.login}</strong>
            {ago ? ` · ${ago}` : ""} · {subject}
          </p>
          {signoff.summary ? <p className="qa-signoff-banner__text">{signoff.summary}</p> : null}
          {signoff.conditions ? (
            <div className="qa-signoff-banner__conditions">
              <span>Conditions</span>
              <p>{signoff.conditions}</p>
            </div>
          ) : null}
          <p className="qa-signoff-banner__note">Signed-off runs are read-only.</p>
        </div>
        <ReopenButton reopen={reopen} className="ghost-button qa-signoff-banner__reopen" />
      </div>
      <ReopenDialog reopen={reopen} />
    </>
  );
}

/* ── Reopen ──────────────────────────────────────────────────────────────── */

/** "Reopen run", for viewers the server lets reopen: opens the confirmation. */
export function ReopenButton({ reopen, className }: Readonly<{ reopen: QaReopenViewModel; className: string }>) {
  if (!reopen.canReopen) return null;
  return (
    <button type="button" className={className} disabled={reopen.status === "reopening"} onClick={reopen.ask}>
      {reopen.status === "reopening" ? "Reopening…" : "Reopen run"}
    </button>
  );
}

/**
 * The confirmation every "Reopen run" goes through: reopening removes the
 * sign-off, so Merge to main is blocked until QA signs off again. A refusal
 * is shown here, to retry or cancel.
 */
export function ReopenDialog({ reopen }: Readonly<{ reopen: QaReopenViewModel }>) {
  return (
    <FormDialog
      open={reopen.confirming}
      onClose={reopen.cancel}
      title={REOPEN_CONFIRM.title}
      description={REOPEN_CONFIRM.text}
      submitLabel="Reopen run"
      submitting={reopen.status === "reopening"}
      error={reopen.error?.message ?? null}
      onSubmit={() => void reopen.reopen()}
    >
      <p className="qa-reopen-confirm__note">{REOPEN_CONFIRM.note}</p>
    </FormDialog>
  );
}

/* ── Signoff footer + dialog ─────────────────────────────────────────────── */

const VERDICT_HINTS: Record<QaVerdict, string> = {
  APPROVED: "Every item passed. Ship it.",
  CONDITIONAL: "Ship, provided the conditions below are met.",
  REJECTED: "Not ready. Send it back.",
};

function readinessText(vm: QaSignoffViewModel): string {
  const approved = vm.eligibility.find((entry) => entry.verdict === "APPROVED");
  if (approved?.allowed) return "Every item passed — ready to approve.";
  return approved?.reason ?? "";
}

export function SignoffFooter({ vm }: Readonly<{ vm: QaSignoffViewModel }>) {
  return (
    <div className="qa-run-card__foot">
      <p className="qa-run-card__foot-text">{readinessText(vm)}</p>
      {vm.canSignOff ? (
        <button type="button" className="primary-button" onClick={vm.openDialog}>
          Sign off
        </button>
      ) : null}
    </div>
  );
}

function VerdictOptions({ vm }: Readonly<{ vm: QaSignoffViewModel }>) {
  const busy = vm.status === "submitting";
  return (
    <fieldset className="qa-verdicts">
      <legend className="hier-field-label">Verdict</legend>
      {vm.eligibility.map((entry) => {
        const checked = vm.verdict === entry.verdict;
        return (
          <label
            key={entry.verdict}
            className={`qa-verdict qa-verdict--${verdictTone(entry.verdict)}${checked ? " qa-verdict--on" : ""}${entry.allowed ? "" : " qa-verdict--off"}`}
          >
            <input
              type="radio"
              name="qa-verdict"
              value={entry.verdict}
              checked={checked}
              disabled={!entry.allowed || busy}
              onChange={() => vm.setVerdict(entry.verdict)}
            />
            <span className="qa-verdict__text">
              <span className="qa-verdict__name">{verdictLabel(entry.verdict)}</span>
              <span className="qa-verdict__hint">{entry.reason ?? VERDICT_HINTS[entry.verdict]}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

export function SignoffDialog({
  vm,
  description,
}: Readonly<{ vm: QaSignoffViewModel; /** What is being signed off, e.g. "Release smoke test on uat @ 9f8e7d6". */ description: string }>) {
  const busy = vm.status === "submitting";
  const allowed = vm.eligibility.some((entry) => entry.verdict === vm.verdict && entry.allowed);
  return (
    <FormDialog
      open={vm.status !== "closed"}
      onClose={vm.closeDialog}
      title="Sign off this run"
      description={`${description}. Signing off locks the run.`}
      submitLabel="Sign off"
      submitting={busy}
      canSubmit={allowed}
      error={vm.error?.message ?? null}
      onSubmit={() => void vm.submit()}
    >
      <VerdictOptions vm={vm} />
      <label className="hier-field">
        <span className="hier-field-label">Summary (optional)</span>
        <textarea
          className="hier-textarea"
          rows={3}
          value={vm.summary}
          disabled={busy}
          placeholder="What was tested, and anything the team should know"
          onChange={(event) => vm.setSummary(event.target.value)}
        />
      </label>
      {vm.verdict === "CONDITIONAL" ? (
        <label className="hier-field">
          <span className="hier-field-label">
            Conditions <span className="qa-required">(required)</span>
          </span>
          <textarea
            className="hier-textarea"
            rows={3}
            value={vm.conditions}
            disabled={busy}
            aria-required="true"
            placeholder="What must be true before this ships"
            onChange={(event) => vm.setConditions(event.target.value)}
          />
        </label>
      ) : null}
      {vm.validationError ? (
        <p className="qa-form-error" role="alert">
          {vm.validationError}
        </p>
      ) : null}
    </FormDialog>
  );
}
