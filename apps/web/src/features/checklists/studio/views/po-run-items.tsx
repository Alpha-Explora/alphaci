"use client";

import { useId, useState } from "react";

import { SeverityBadge, StatusPill } from "../../items";
import { QaFindings } from "../../returned";
import { groupPassLabel, groupRunItems } from "../../model/project-run-rules";
import type { ProjectQaRun } from "../../model/project-run-types";
import { kindCopy } from "../../model/requirement-rules";

function itemCountLabel(count: number): string {
  return count === 1 ? "1 item" : `${String(count)} items`;
}

/**
 * The QA run, read-only, in PO Studio's own rail: every item QA has, grouped
 * by Feature, with QA's verdict and, where it sent one back, failed it or
 * blocked it, why. A Product owner reads it beside the live page instead of
 * leaving for the Checklists tab; verifying stays with the QA Team.
 *
 * Closed by default, so the acceptance and Merge to main stay at the top.
 */
export function PoRunItems({ run }: Readonly<{ run: ProjectQaRun }>) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (run.items.length === 0) return null;
  const groups = groupRunItems(run.items);
  return (
    <section className="po-run" aria-label="QA run results">
      <button
        type="button"
        className="ghost-button po-run__toggle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide the QA run" : "View the QA run"}
        <span className="po-run__count">{itemCountLabel(run.items.length)}</span>
      </button>
      <div id={listId} className="po-run__groups" hidden={!open}>
        {groups.map((group) => (
          <section key={group.key} className="po-run__group" aria-label={`${kindCopy(group.kind).singular} ${group.requirementName}`}>
            <p className="po-run__group-head">
              <span className="po-run__kind">{kindCopy(group.kind).singular}</span>
              <span className="po-run__name">{group.requirementName}</span>
              <span className="po-run__passed">{groupPassLabel(group)}</span>
            </p>
            <ol className="po-run__items">
              {group.items.map((item) => (
                <li key={item.id} className="po-run__item" data-status={item.status}>
                  <div className="po-run__item-head">
                    <span className="po-run__title">{item.title}</span>
                    <span className="po-run__verdict">
                      {item.defectSeverity ? <SeverityBadge severity={item.defectSeverity} /> : null}
                      <StatusPill status={item.status} />
                    </span>
                  </div>
                  <QaFindings runItem={item} />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
}
