"use client";

import { ChecklistItemList } from "../../items";
import type { ChecklistShareTarget, QaChecklist } from "../../model/checklist-types";
import {
  automatedItemCount,
  isArchived,
  itemCountLabel,
  updatedLabel,
} from "../../model/checklist-rules";
import { useArchiveChecklistViewModel } from "../view-models/use-archive-checklist-view-model";
import { useShareChecklistViewModel } from "../view-models/use-share-checklist-view-model";
import { ArchiveChecklistDialog } from "./archive-checklist-dialog";
import { ShareChecklistDialog } from "./share-checklist-dialog";

function sharedTargets(
  checklist: QaChecklist,
  projects: ReadonlyArray<ChecklistShareTarget>,
): Array<{ id: string; name: string }> {
  const byId = new Map(projects.map((project) => [project.id, project.name]));
  return checklist.sharedProjectIds.map((id) => ({
    id,
    // A project the viewer cannot see still counts; it just has no name here.
    name: byId.get(id) ?? "Project outside your access",
  }));
}

function SharedWith({
  checklist,
  projects,
  canShare,
  onShare,
}: Readonly<{
  checklist: QaChecklist;
  projects: ReadonlyArray<ChecklistShareTarget>;
  canShare: boolean;
  onShare: () => void;
}>) {
  const targets = sharedTargets(checklist, projects);
  return (
    <div className="qa-detail__shared">
      <span className="qa-detail__shared-label">Shared to</span>
      {targets.length > 0 ? (
        <ul className="qa-detail__chips">
          {targets.map((target) => (
            <li key={target.id} className="qa-project-chip">
              {target.name}
            </li>
          ))}
        </ul>
      ) : (
        <span className="qa-detail__unshared">
          No projects yet.
          {canShare ? (
            <>
              {" "}
              <button type="button" className="inline-link qa-link-button" onClick={onShare}>
                Share it
              </button>{" "}
              so it appears on a project&apos;s Checklists tab.
            </>
          ) : null}
        </span>
      )}
    </div>
  );
}

/**
 * One checklist, read-only. Leads get Edit / Share / Archive beside the title;
 * everyone else sees exactly the same page minus those three buttons.
 */
export function ChecklistDetail({
  checklist,
  projects,
  canManage,
  now,
  onEdit,
  onShared,
  onArchived,
}: Readonly<{
  checklist: QaChecklist;
  projects: ReadonlyArray<ChecklistShareTarget>;
  canManage: boolean;
  now: number;
  onEdit: () => void;
  onShared: (checklist: QaChecklist) => void;
  onArchived: (checklist: QaChecklist) => void;
}>) {
  const share = useShareChecklistViewModel({ checklist, onShared });
  const archive = useArchiveChecklistViewModel({ checklist, onArchived });
  const archived = isArchived(checklist);
  const editable = canManage && !archived;
  const automated = automatedItemCount(checklist.items);

  return (
    <article className="qa-detail">
      <header className="qa-detail__head">
        <div className="qa-detail__titles">
          <h4 className="qa-detail__title">
            {checklist.name}
            {archived ? <span className="hier-badge hier-badge--muted">Archived</span> : null}
          </h4>
          <p className="qa-detail__meta">
            <span>{itemCountLabel(checklist.items.length)}</span>
            {automated > 0 ? <span>{automated} automated</span> : null}
            <span>Version {checklist.version}</span>
            <span>{updatedLabel(checklist.updatedAt, now)}</span>
          </p>
        </div>
        {editable ? (
          <div className="qa-detail__actions">
            <button type="button" className="primary-button group-section-action" onClick={onEdit}>
              Edit checklist
            </button>
            <button type="button" className="ghost-button group-section-action" onClick={share.openDialog}>
              Share
            </button>
            <button type="button" className="hier-btn-danger" onClick={archive.openDialog}>
              Archive
            </button>
          </div>
        ) : null}
      </header>

      {checklist.description ? (
        <p className="qa-detail__desc">{checklist.description}</p>
      ) : null}

      <SharedWith
        checklist={checklist}
        projects={projects}
        canShare={editable}
        onShare={share.openDialog}
      />

      <section className="qa-detail__items" aria-label="Checklist items">
        <h5 className="qa-subhead">Items</h5>
        <ChecklistItemList
          items={checklist.items}
          emptyMessage={
            editable
              ? "No items yet. Edit the checklist to add the checks people should run."
              : "This checklist has no items yet."
          }
        />
      </section>

      {editable ? (
        <>
          <ShareChecklistDialog checklist={checklist} projects={projects} vm={share} />
          <ArchiveChecklistDialog checklist={checklist} vm={archive} />
        </>
      ) : null}
    </article>
  );
}
