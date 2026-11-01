"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { LoadingRows } from "@/features/groups/workspace";

import type { ChecklistsStatus, QaChecklist } from "../../model/checklist-types";
import {
  automatedItemCount,
  checklistOwningProjectId,
  isArchived,
  itemCountLabel,
  sharedCountLabel,
  updatedLabel,
} from "../../model/checklist-rules";
import { ChecklistGlyph, ChevronRightIcon } from "./checklist-icons";

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

/** Empty, loading and error states, drawn with the team page's own state card. */
function ListState({
  status,
  error,
  canManage,
  showArchived,
  onRetry,
  projectsHref,
}: Readonly<{
  status: ChecklistsStatus;
  error: string | null;
  canManage: boolean;
  showArchived: boolean;
  onRetry: () => void;
  /** Where requirements are written now: the team's Projects. */
  projectsHref: string;
}>) {
  if (status === "loading") return <LoadingRows rows={3} />;
  if (status === "error") {
    return (
      <div className="hier-state" role="alert">
        <span className="hier-state-icon hier-state-icon--danger" aria-hidden="true">
          <ChecklistGlyph size={22} />
        </span>
        <h4 className="hier-state-title">QA checklists did not load</h4>
        <p className="hier-state-text">{error}</p>
        <button type="button" className="ghost-button group-section-action" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  return (
    <div className="hier-state qa-empty">
      <span className="hier-state-icon qa-empty__icon" aria-hidden="true">
        <ChecklistGlyph size={22} />
      </span>
      <h4 className="hier-state-title">
        {showArchived ? "No checklists, archived or otherwise" : "No QA checklists yet"}
      </h4>
      <p className="hier-state-text">
        {canManage
          ? "Requirements now belong to Projects. Open a Project to add Features and System requirements; they apply to every repository in it."
          : "Requirements now belong to Projects. Your Product owner writes them on each Project."}
      </p>
      {canManage ? (
        <Link className="primary-button group-section-action" href={projectsHref}>
          Open Projects
        </Link>
      ) : null}
    </div>
  );
}

function ChecklistRow({
  checklist,
  now,
  onOpen,
}: Readonly<{ checklist: QaChecklist; now: number; onOpen: () => void }>) {
  const archived = isArchived(checklist);
  const automated = automatedItemCount(checklist.items);
  return (
    <button
      type="button"
      className={`qa-list-row${archived ? " qa-list-row--archived" : ""}`}
      onClick={onOpen}
    >
      <span className="qa-list-row__icon" aria-hidden="true">
        <ChecklistGlyph />
      </span>
      <span className="qa-list-row__main">
        <span className="qa-list-row__title">
          <span className="qa-list-row__name">{checklist.name}</span>
          {archived ? <span className="hier-badge hier-badge--muted">Archived</span> : null}
        </span>
        {checklist.description ? (
          <span className="qa-list-row__desc">{checklist.description}</span>
        ) : null}
        <span className="qa-list-row__meta">
          <span className="qa-meta-pill">{itemCountLabel(checklist.items.length)}</span>
          {automated > 0 ? (
            <span className="qa-meta-pill qa-meta-pill--auto">{automated} automated</span>
          ) : null}
          {checklistOwningProjectId(checklist) ? (
            <span className="qa-meta-pill">System requirement of a Project</span>
          ) : (
            <span
              className={`qa-meta-pill${checklist.sharedProjectIds.length === 0 ? " qa-meta-pill--quiet" : ""}`}
            >
              {sharedCountLabel(checklist.sharedProjectIds.length)}
            </span>
          )}
        </span>
      </span>
      <span className="qa-list-row__aside">
        <span className="qa-list-row__updated">{updatedLabel(checklist.updatedAt, now)}</span>
        <span className="qa-list-row__chevron" aria-hidden="true">
          <ChevronRightIcon />
        </span>
      </span>
    </button>
  );
}

/**
 * The team's checklists, one row each. The whole row opens the checklist —
 * the same rule the Repositories section follows, where the name is the link.
 */
export function ChecklistList({
  status,
  error,
  checklists,
  canManage,
  now,
  showArchived,
  onShowArchivedChange,
  onOpen,
  onRetry,
  projectsHref,
}: Readonly<{
  status: ChecklistsStatus;
  error: string | null;
  checklists: QaChecklist[];
  canManage: boolean;
  now: number;
  showArchived: boolean;
  onShowArchivedChange: (value: boolean) => void;
  onOpen: (checklistId: string) => void;
  onRetry: () => void;
  projectsHref: string;
}>) {
  const reduced = useReducedMotion();
  const hasRows = status === "ready" && checklists.length > 0;
  return (
    <div className="qa-list">
      <div className="qa-list__toolbar">
        <p className="group-section-lede qa-list__lede">
          This team&apos;s earlier QA checklists. Each is now a System requirement of the
          Project its repositories belong to, edited there; new requirements are written
          on a Project.
        </p>
        <label className="qa-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => onShowArchivedChange(event.target.checked)}
          />
          <span className="qa-toggle__track" aria-hidden="true" />
          <span>Show archived</span>
        </label>
      </div>
      {hasRows ? (
        <ul className="qa-list__rows">
          {checklists.map((checklist, index) => (
            <motion.li
              key={checklist.id}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: EASE_OUT, delay: Math.min(index, 6) * 0.04 }}
            >
              <ChecklistRow
                checklist={checklist}
                now={now}
                onOpen={() => onOpen(checklist.id)}
              />
            </motion.li>
          ))}
        </ul>
      ) : (
        <ListState
          status={status}
          error={error}
          canManage={canManage}
          showArchived={showArchived}
          onRetry={onRetry}
          projectsHref={projectsHref}
        />
      )}
    </div>
  );
}
