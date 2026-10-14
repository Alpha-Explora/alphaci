"use client";

import type { ItemProgressViewModel } from "../../returned";
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
import { FeatureIcon, PlusIcon, SystemIcon } from "./requirement-icons";
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
}: Readonly<{
  requirement: Requirement;
  permissions: RequirementPermissions;
  items: RequirementItemsViewModel;
  progress: ItemProgressViewModel;
  onReload: () => void;
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
      {requirement.items.map((item, index) => (
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
        />
      ))}
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

  return (
    <article className="rq-card" data-kind={requirement.kind} aria-labelledby={titleId}>
      <header className="rq-card__head">
        <span className="rq-card__icon" aria-hidden="true">
          {requirement.kind === "functional" ? <FeatureIcon /> : <SystemIcon />}
        </span>
        <div className="rq-card__titles">
          <span className="rq-card__eyebrow">{copy.singular}</span>
          <h4 className="rq-card__title" id={titleId}>
            {requirement.name}
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

      <CardItems requirement={requirement} permissions={permissions} items={items} progress={progress} onReload={onReload} />
      {canManage ? <AddItem items={items} addLabel={copy.addItem} itemLabel={copy.item} /> : null}
    </article>
  );
}
