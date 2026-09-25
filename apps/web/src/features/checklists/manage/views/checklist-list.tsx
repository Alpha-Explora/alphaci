"use client";

import { motion, useReducedMotion } from "framer-motion";

import { LoadingRows } from "@/features/groups/workspace";

import type { ChecklistsStatus, QaChecklist } from "../../model/checklist-types";
import {
  automatedItemCount,
  isArchived,
  itemCountLabel,
  sharedCountLabel,
  updatedLabel,
} from "../../model/checklist-rules";
import { ChecklistGlyph, ChevronRightIcon, PlusIcon } from "./checklist-icons";

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

/** Empty, loading and error states, drawn with the team page's own state card. */
function ListState({
  status,
  error,
  canManage,
  showArchived,
  onRetry,
  onCreate,
}: Readonly<{
  status: ChecklistsStatus;
  error: string | null;
  canManage: boolean;
  showArchived: boolean;
  onRetry: () => void;
  onCreate: () => void;
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
          ? "Write the checks a change has to pass before it ships — once — then share the checklist to the projects that need it."
          : "Your team lead has not written any QA checklists for this team yet. Shared ones appear here and on each project's Checklists tab."}
      </p>
      {canManage ? (
        <button type="button" className="primary-button group-section-action" onClick={onCreate}>
          <PlusIcon />
          Create the first checklist
        </button>
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
          <span
            className={`qa-meta-pill${checklist.sharedProjectIds.length === 0 ? " qa-meta-pill--quiet" : ""}`}
          >
            {sharedCountLabel(checklist.sharedProjectIds.length)}
          </span>
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
  onCreate,
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
  onCreate: () => void;
}>) {
  const reduced = useReducedMotion();
  const hasRows = status === "ready" && checklists.length > 0;
  return (
    <div className="qa-list">
      <div className="qa-list__toolbar">
        <p className="group-section-lede qa-list__lede">
          Reusable acceptance checks for this team. Leads write them once and share
          them to projects; developers and QA work through them on each
          project&apos;s Checklists tab.
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
          onCreate={onCreate}
        />
      )}
    </div>
  );
}
