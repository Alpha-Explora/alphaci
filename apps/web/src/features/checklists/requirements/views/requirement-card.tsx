"use client";

import { useState } from "react";

import type { ItemProgressViewModel } from "../../returned";
import { itemMatches, NO_VERDICTS, type ChecklistFilter, type ItemVerdicts } from "../../model/checklist-filter-rules";
import {
  donePercent,
  itemProgressEditable,
  kindCopy,
  progressSummaryLabel,
} from "../../model/requirement-rules";
import type { Requirement, RequirementItem } from "../../model/requirement-types";
import type { RequirementPermissions } from "../../model/requirement-rules";
import {
  useRequirementItemsViewModel,
  type RequirementItemsViewModel,
} from "../view-models/use-requirement-items-view-model";
import { ChevronDownIcon, FeatureIcon, PlusIcon, SystemIcon } from "./requirement-icons";
import { ItemForm, RequirementItemRow } from "./requirement-item-row";

/** Done's share as a quiet meter: the words beside it carry the number. */
function ProgressMeter({ requirement }: Readonly<{ requirement: Requirement }>) {
  const percent = donePercent(requirement.progressCounts);
  return (
    <span className="rq-meter">
      <span className="rq-meter__track" aria-hidden="true">
        <span className="rq-meter__fill" style={{ width: `${percent}%` }} />
      </span>
      <span className="rq-meter__label">{progressSummaryLabel(requirement.progressCounts)}</span>
    </span>
  );
}

function CardItems({
  requirement,
  permissions,
  items,
  progress,
  onReload,
  verdicts,
  filter,
}: Readonly<{
  requirement: Requirement;
  permissions: RequirementPermissions;
  items: RequirementItemsViewModel;
  progress: ItemProgressViewModel;
  onReload: () => void;
  verdicts: ItemVerdicts;
  filter: ChecklistFilter;
}>) {
  const copy = kindCopy(requirement.kind);
  if (requirement.items.length === 0) {
    return (
      <p className="rq-note">
        {permissions.canManage
          ? `No ${copy.items.toLowerCase()} yet. Add the first one so Developers know what to build and QA knows what to verify.`
          : `No ${copy.items.toLowerCase()} yet.`}
      </p>
    );
  }
  return (
    <ol className="rq-items" aria-label={`${copy.items} of ${requirement.name}`}>
      {/* A filter hides rows, never renumbers them: 03 stays the third story. */}
      {requirement.items.map((item, index) => itemMatches(item, verdicts, filter) ? (
        <RequirementItemRow
          key={item.id}
          item={item}
          index={index}
          count={requirement.items.length}
          itemLabel={copy.item}
          canManage={permissions.canManage}
          progressEditable={itemProgressEditable(item, permissions.canSetProgress)}
          items={items}
          progress={progress}
          onReload={onReload}
          verdict={verdicts.get(item.id)}
        />
      ) : null)}
    </ol>
  );
}

/** "Add user story": the button, or the form once pressed. */
function AddItem({
  items,
  addLabel,
  itemLabel,
}: Readonly<{ items: RequirementItemsViewModel; addLabel: string; itemLabel: string }>) {
  if (items.editing?.mode === "add") return <ItemForm vm={items} itemLabel={itemLabel} submitLabel={addLabel} />;
  return (
    <button type="button" className="rq-add" onClick={items.startAdd} disabled={items.status === "saving"}>
      <PlusIcon />
      {addLabel}
    </button>
  );
}

/**
 * One requirement: a Feature with its User stories, or a System requirement
 * with its items. Product owners and admins edit, archive and reorder it;
 * Developers move each item's Progress; everyone sees the same card.
 *
 * The card opens like a dropdown: its title, description and progress show,
 * and its items stay hidden until the title is pressed. Hidden, not
 * unmounted, so an item being edited keeps its draft when the card closes.
 *
 * With a `filter` on (the checklist chips) it shows only the items that
 * match, and opens by itself so they are in view; pressing the title still
 * closes it. `verdicts` puts QA's verdict on each item.
 */
export function RequirementCard({
  requirement,
  permissions,
  progress,
  onEdit,
  onArchive,
  onItem,
  onRemoved,
  onRequirement,
  onReload,
  verdicts = NO_VERDICTS,
  filter = "all",
}: Readonly<{
  requirement: Requirement;
  permissions: RequirementPermissions;
  progress: ItemProgressViewModel;
  onEdit: (requirement: Requirement) => void;
  onArchive: (requirement: Requirement) => void;
  onItem: (item: RequirementItem) => void;
  onRemoved: (requirementId: string, itemId: string) => void;
  onRequirement: (requirement: Requirement) => void;
  onReload: () => void;
  verdicts?: ItemVerdicts;
  filter?: ChecklistFilter;
}>) {
  const copy = kindCopy(requirement.kind);
  const items = useRequirementItemsViewModel({
    requirement,
    itemLabel: copy.item,
    onItem,
    onRemoved,
    onRequirement,
  });
  const canManage = permissions.canManage;
  const titleId = `rq-${requirement.id}`;
  const itemsId = `rq-${requirement.id}-items`;
  // Closed by default, open while a filter is on. A press holds only for the
  // filter it was made under: choosing another chip shows its matches again.
  const [pressed, setPressed] = useState<{ filter: ChecklistFilter; open: boolean } | null>(null);
  const open = pressed?.filter === filter ? pressed.open : filter !== "all";

  return (
    <article className="rq-card" data-kind={requirement.kind} data-open={String(open)} aria-labelledby={titleId}>
      <header className="rq-card__head">
        <span className="rq-card__icon" aria-hidden="true">
          {requirement.kind === "functional" ? <FeatureIcon /> : <SystemIcon />}
        </span>
        <div className="rq-card__titles">
          <span className="rq-card__eyebrow">{copy.singular}</span>
          <h4 className="rq-card__title" id={titleId}>
            <button
              type="button"
              className="rq-card__toggle"
              aria-expanded={open}
              aria-controls={itemsId}
              onClick={() => setPressed({ filter, open: !open })}
            >
              <span className="rq-card__name">{requirement.name}</span>
              <span className="rq-card__chevron">
                <ChevronDownIcon />
              </span>
            </button>
          </h4>
          {requirement.description ? <p className="rq-card__desc">{requirement.description}</p> : null}
        </div>
        <div className="rq-card__aside">
          <ProgressMeter requirement={requirement} />
          {canManage ? (
            <span className="rq-card__actions">
              <button type="button" className="ghost-button" onClick={() => onEdit(requirement)}>
                Edit
              </button>
              <button type="button" className="rq-link rq-link--danger" onClick={() => onArchive(requirement)}>
                Archive
              </button>
            </span>
          ) : null}
        </div>
      </header>

      <div id={itemsId} className="rq-card__body" hidden={!open}>
        <CardItems
          requirement={requirement}
          permissions={permissions}
          items={items}
          progress={progress}
          onReload={onReload}
          verdicts={verdicts}
          filter={filter}
        />
        {canManage ? <AddItem items={items} addLabel={copy.addItem} itemLabel={copy.item} /> : null}
      </div>
    </article>
  );
}
