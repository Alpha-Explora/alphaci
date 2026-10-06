"use client";

import "./pipeline-visual-checks.css";

import { useId, useState, type CSSProperties } from "react";

import { relativeTime } from "@/features/runs";

import {
  APPROVE_ONE_LABEL,
  NEW_SNAPSHOT_NOTE,
  approvableNames,
  approveAllLabel,
  groupSnapshots,
  inheritsUatReferences,
  isApprovable,
  offersLoadLatest,
  visualCounts,
  visualEmptyMessage,
  visualHeader,
  visualReadOnlyNote,
} from "../../model/visual-check-rules";
import type { VisualSnapshot } from "../../model/visual-check-types";
import type { VisualChecksViewModel } from "../../view-models/use-visual-checks-view-model";
import { ChevronIcon, InfoIcon } from "./pipeline-glyphs";

/**
 * The Verify stage's screenshots against their references, and approving a
 * change as the new reference.
 *
 * Changed screenshots come first, each as Reference / New / Difference side
 * by side (or one over the other with a slider), because a changed screenshot
 * is the one that might be a regression. New screenshots follow; passing ones
 * fold into a list of names, since there is nothing to look at.
 *
 * Approving has no confirmation and no undo — the next run compares against
 * whatever was approved — so every button says exactly what it does.
 */
export function VisualChecksPanel({
  view,
  branch,
}: Readonly<{ view: VisualChecksViewModel; branch: string }>) {
  const headingId = useId();
  return (
    <section className="pipe-visual" aria-labelledby={headingId}>
      <VisualBody view={view} branch={branch} headingId={headingId} />
    </section>
  );
}

function VisualBody({
  view,
  branch,
  headingId,
}: Readonly<{ view: VisualChecksViewModel; branch: string; headingId: string }>) {
  if (view.status === "idle" || view.status === "loading") {
    return (
      <>
        <h6 id={headingId} className="pipe-visual__title">Visual checks</h6>
        <p className="pipe-stage__reason" role="status">Reading the visual checks…</p>
      </>
    );
  }
  if (view.status === "error" || !view.checks) {
    return (
      <>
        <h6 id={headingId} className="pipe-visual__title">Visual checks</h6>
        <p className="pipe-stage__reason" role="alert">
          {view.error ?? "The visual checks could not be read."}{" "}
          <button type="button" className="pipe-text-button" onClick={view.reload}>
            Retry
          </button>
        </p>
      </>
    );
  }
  if (view.checks.runId === null) {
    return (
      <>
        <h6 id={headingId} className="pipe-visual__title">Visual checks</h6>
        <p className="pipe-visual__empty">{visualEmptyMessage(branch)}</p>
      </>
    );
  }
  return <VisualResults view={view} branch={branch} headingId={headingId} />;
}

function VisualResults({
  view,
  branch,
  headingId,
}: Readonly<{ view: VisualChecksViewModel; branch: string; headingId: string }>) {
  const snapshots = view.checks?.snapshots ?? [];
  const groups = groupSnapshots(snapshots);
  const pending = approvableNames(snapshots);
  const canAct = view.readOnly === null;

  return (
    <>
      <div className="pipe-visual__head">
        <div className="pipe-visual__heading">
          <h6 id={headingId} className="pipe-visual__title">
            {visualHeader(visualCounts(snapshots))}
          </h6>
          {inheritsUatReferences(snapshots) && (
            <span className="pipe-visual__inherit">inherits UAT references</span>
          )}
        </div>
        {canAct && pending.length > 0 && (
          <ApproveButton
            label={approveAllLabel(pending.length)}
            busy={view.approving.length > 0 && view.approving.length === pending.length}
            disabled={view.approving.length > 0}
            onClick={() => view.approve(pending)}
          />
        )}
      </div>

      <ReadOnlyNote view={view} branch={branch} />
      <ApproveFailure view={view} />

      {[...groups.changed, ...groups.added].map((snapshot) => (
        <SnapshotCard key={snapshot.name} snapshot={snapshot} view={view} canAct={canAct} />
      ))}
      <PassedList snapshots={groups.passed} />
    </>
  );
}

/* ── Read-only and refusals ─────────────────────────────────────────────── */

function ReadOnlyNote({ view, branch }: Readonly<{ view: VisualChecksViewModel; branch: string }>) {
  if (view.readOnly === null) return null;
  const changes = (view.checks?.snapshots ?? []).some((snapshot) => snapshot.status !== "passed");
  // A role note on a run with nothing to approve would answer a question nobody asked.
  if (view.readOnly === "role" && !changes) return null;
  return (
    <p className="pipe-banner pipe-banner--muted pipe-visual__note" role="note">
      <InfoIcon />
      <span>
        {visualReadOnlyNote(view.readOnly, branch)}
        {view.readOnly === "not-latest" && (
          <>
            {" "}
            <button type="button" className="pipe-text-button" onClick={view.loadLatest}>
              Load latest run
            </button>
          </>
        )}
      </span>
    </p>
  );
}

function ApproveFailure({ view }: Readonly<{ view: VisualChecksViewModel }>) {
  const failure = view.approveError;
  // A role refusal hides the actions; the read-only note already says why.
  if (!failure || failure.kind === "forbidden") return null;
  return (
    <p className="pipe-banner pipe-banner--danger pipe-visual__note" role="alert">
      <InfoIcon />
      <span>
        {failure.message}
        {offersLoadLatest(failure) && (
          <>
            {" "}
            <button type="button" className="pipe-text-button" onClick={view.loadLatest}>
              Load latest run
            </button>
          </>
        )}
      </span>
    </p>
  );
}

/* ── One changed or new screenshot ──────────────────────────────────────── */

const STATUS_CHIP: Record<"changed" | "new", { tone: string; label: string }> = {
  changed: { tone: "warning", label: "Changed" },
  new: { tone: "running", label: "New" },
};

function SnapshotCard({
  snapshot,
  view,
  canAct,
}: Readonly<{ snapshot: VisualSnapshot; view: VisualChecksViewModel; canAct: boolean }>) {
  const nameId = useId();
  const [compare, setCompare] = useState(false);
  const changed = snapshot.status === "changed";
  const comparable = changed && snapshot.baselineUrl !== null && snapshot.actualUrl !== null;
  const chip = STATUS_CHIP[changed ? "changed" : "new"];

  return (
    <article className={`pipe-shot pipe-shot--${snapshot.status}`} aria-labelledby={nameId}>
      <div className="pipe-shot__head">
        <code id={nameId} className="pipe-shot__name">{snapshot.name}</code>
        <span className={`pipe-chip pipe-chip--${chip.tone}`}>
          <span className="pipe-chip__dot" aria-hidden="true" />
          {chip.label}
        </span>
        <span className="pipe-shot__actions">
          {comparable && (
            <button
              type="button"
              className="pipe-text-button"
              aria-pressed={compare}
              onClick={() => setCompare(!compare)}
            >
              {compare ? "Side by side" : "Compare"}
            </button>
          )}
          <SnapshotApproval snapshot={snapshot} view={view} canAct={canAct} />
        </span>
      </div>

      <SnapshotImages snapshot={snapshot} compare={comparable && compare} />

      <ReferenceLine snapshot={snapshot} />
    </article>
  );
}

function SnapshotImages({
  snapshot,
  compare,
}: Readonly<{ snapshot: VisualSnapshot; compare: boolean }>) {
  if (snapshot.status !== "changed") return <NewPane snapshot={snapshot} />;
  return compare ? <CompareSlider snapshot={snapshot} /> : <ChangedPanes snapshot={snapshot} />;
}

function SnapshotApproval({
  snapshot,
  view,
  canAct,
}: Readonly<{ snapshot: VisualSnapshot; view: VisualChecksViewModel; canAct: boolean }>) {
  if (snapshot.approved) {
    return <span className="pipe-shot__approved">Approved</span>;
  }
  if (!canAct || !isApprovable(snapshot)) return null;
  return (
    <ApproveButton
      label={APPROVE_ONE_LABEL}
      busy={view.approving.includes(snapshot.name)}
      disabled={view.approving.length > 0}
      onClick={() => view.approve([snapshot.name])}
      target={snapshot.name}
    />
  );
}

function ApproveButton({
  label,
  busy,
  disabled,
  onClick,
  target,
}: Readonly<{
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  /** The screenshot this approves, read after the label by a screen reader. */
  target?: string;
}>) {
  return (
    <button
      type="button"
      className="pipe-approve"
      aria-busy={busy}
      disabled={disabled}
      onClick={onClick}
    >
      {busy ? "Approving…" : label}
      {target && <span className="sr-only">: {target}</span>}
    </button>
  );
}

/** "Reference approved by @lloyd · 3d ago", and where a main reference came from. */
function ReferenceLine({ snapshot }: Readonly<{ snapshot: VisualSnapshot }>) {
  const by = snapshot.baselineApprovedBy;
  const at = snapshot.baselineApprovedAt;
  if (!by && !at && !snapshot.inheritedFrom) return null;
  return (
    <p className="pipe-shot__meta">
      {(by || at) && <span>Reference approved{by ? ` by @${by}` : ""}</span>}
      {at && (
        <time dateTime={at} title={new Date(at).toLocaleString()}>
          {relativeTime(at)}
        </time>
      )}
      {snapshot.inheritedFrom && <span>from {snapshot.inheritedFrom.toUpperCase()}</span>}
    </p>
  );
}

/* ── The images ─────────────────────────────────────────────────────────── */

/**
 * A screenshot read straight from the API. A plain `<img>` on purpose:
 * next/image would route it through the optimiser, which fetches without the
 * session cookie the image route needs, and these are diff evidence that must
 * not be resampled.
 */
function Shot({ src, alt, className }: Readonly<{ src: string; alt: string; className: string }>) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={className} />;
}

/**
 * One captioned image in a fixed-ratio box. Full-page screenshots are tall,
 * so the box scrolls rather than stretching the card; it takes focus so the
 * scroll is reachable from the keyboard.
 */
function Pane({
  label,
  name,
  src,
}: Readonly<{ label: string; name: string; src: string | null }>) {
  return (
    <figure className="pipe-pane">
      <figcaption className="pipe-pane__label">{label}</figcaption>
      <div className="pipe-pane__frame" role="region" aria-label={`${label}: ${name}`} tabIndex={0}>
        {src ? (
          <Shot src={src} alt={`${label} screenshot of ${name}`} className="pipe-pane__img" />
        ) : (
          <p className="pipe-pane__none">No image</p>
        )}
      </div>
    </figure>
  );
}

function ChangedPanes({ snapshot }: Readonly<{ snapshot: VisualSnapshot }>) {
  return (
    <div className="pipe-panes">
      <Pane label="Reference" name={snapshot.name} src={snapshot.baselineUrl} />
      <Pane label="New" name={snapshot.name} src={snapshot.actualUrl} />
      <Pane label="Difference" name={snapshot.name} src={snapshot.diffUrl} />
    </div>
  );
}

function NewPane({ snapshot }: Readonly<{ snapshot: VisualSnapshot }>) {
  return (
    <>
      <p className="pipe-shot__note">{NEW_SNAPSHOT_NOTE}</p>
      <div className="pipe-panes pipe-panes--single">
        <Pane label="New" name={snapshot.name} src={snapshot.actualUrl} />
      </div>
    </>
  );
}

/**
 * The reference with the new screenshot laid over it, revealed from the right
 * by a native range input — keyboard operable (arrows, Home, End) with no
 * dependency and no custom drag code.
 */
function CompareSlider({ snapshot }: Readonly<{ snapshot: VisualSnapshot }>) {
  const [split, setSplit] = useState(50);
  const style = { "--pipe-split": `${String(split)}%` } as CSSProperties;
  return (
    <div className="pipe-compare" style={style}>
      <div
        className="pipe-pane__frame pipe-compare__frame"
        role="region"
        aria-label={`Reference and new: ${snapshot.name}`}
        tabIndex={0}
      >
        <div className="pipe-compare__stack">
          <Shot
            src={snapshot.baselineUrl ?? ""}
            alt={`Reference screenshot of ${snapshot.name}`}
            className="pipe-compare__base"
          />
          <Shot
            src={snapshot.actualUrl ?? ""}
            alt={`New screenshot of ${snapshot.name}`}
            className="pipe-compare__top"
          />
          <span className="pipe-compare__line" aria-hidden="true" />
        </div>
      </div>
      <label className="pipe-compare__control">
        <span className="pipe-compare__end">Reference</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={split}
          aria-label={`Show the new screenshot of ${snapshot.name}`}
          aria-valuetext={`${String(split)}% new`}
          onChange={(event) => setSplit(Number(event.target.value))}
        />
        <span className="pipe-compare__end">New</span>
      </label>
    </div>
  );
}

/* ── Passing screenshots ────────────────────────────────────────────────── */

/**
 * Passing screenshots as a folded list of names, each with a small thumbnail
 * — loaded only once the list is opened, since nobody needs to see them.
 */
function PassedList({ snapshots }: Readonly<{ snapshots: readonly VisualSnapshot[] }>) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  if (snapshots.length === 0) return null;
  return (
    <div className="pipe-visual__passed">
      <button
        type="button"
        className="pipe-toggle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
      >
        {snapshots.length === 1 ? "1 unchanged screenshot" : `${String(snapshots.length)} unchanged screenshots`}
        <ChevronIcon />
      </button>
      <ul id={listId} className="pipe-passed" hidden={!open}>
        {open &&
          snapshots.map((snapshot) => {
            const src = snapshot.actualUrl ?? snapshot.baselineUrl;
            return (
              <li key={snapshot.name} className="pipe-passed__row">
                <span className="pipe-passed__thumb">
                  {src && <Shot src={src} alt={`${snapshot.name}, unchanged`} className="pipe-passed__img" />}
                </span>
                <code className="pipe-passed__name">{snapshot.name}</code>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

/** "Visual: 2 changed" beside the Verify stage, once its checks have been read. */
export function VisualChip({ label }: Readonly<{ label: string | null }>) {
  if (!label) return null;
  return (
    <span className="pipe-chip pipe-chip--warning pipe-visual-chip">
      <span className="pipe-chip__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
