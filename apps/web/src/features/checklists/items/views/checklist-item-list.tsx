"use client";

import "./checklist-items.css";

import type { QaChecklistItem } from "../../model/checklist-types";
import { needsTestIdentifier } from "../../model/checklist-rules";
import { PersonaBadge, VerificationBadge } from "./checklist-badges";

function positionLabel(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/**
 * A checklist's items, read-only and in order.
 *
 * Shared by the team's checklist view and the project's Checklists tab, so the
 * same item reads the same everywhere. Later slices tick these per branch; the
 * number column is where that state will sit.
 */
export function ChecklistItemList({
  items,
  emptyMessage = "This checklist has no items yet.",
}: Readonly<{
  items: ReadonlyArray<QaChecklistItem>;
  emptyMessage?: string;
}>) {
  if (items.length === 0) {
    return <p className="qa-items-empty">{emptyMessage}</p>;
  }
  const ordered = [...items].sort((a, b) => a.position - b.position);
  return (
    <ol className="qa-items">
      {ordered.map((item, index) => (
        <li key={item.id} className="qa-item">
          <span className="qa-item__pos" aria-hidden="true">
            {positionLabel(index)}
          </span>
          <div className="qa-item__body">
            <div className="qa-item__head">
              <span className="qa-item__title">{item.title}</span>
              <PersonaBadge persona={item.targetPersona} />
            </div>
            {item.description ? (
              <p className="qa-item__desc">{item.description}</p>
            ) : null}
            <div className="qa-item__verify">
              <VerificationBadge type={item.verificationType} />
              {needsTestIdentifier(item.verificationType) && item.testIdentifier ? (
                <code className="qa-item__test">{item.testIdentifier}</code>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
