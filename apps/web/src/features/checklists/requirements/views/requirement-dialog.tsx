"use client";

import {
  useEffect,
  useId,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import { FormDialog } from "@/features/groups/workspace";

import {
  addCardLabel,
  batchLimitNote,
  cardHeading,
} from "../../model/requirement-batch-rules";
import { kindCopy, REQUIREMENT_NAME_MAX } from "../../model/requirement-rules";
import type { RequirementCardDraft, RequirementKind } from "../../model/requirement-types";
import type {
  RequirementDialogMode,
  RequirementDialogViewModel,
} from "../view-models/use-requirement-dialog-view-model";
import { PlusIcon, RemoveIcon } from "./requirement-icons";

const PLACEHOLDERS: Record<RequirementKind, { name: string; description: string; items: readonly string[] }> = {
  functional: {
    name: "Checkout with saved cards",
    description: "Why this matters, and for whom",
    items: ["As a shopper, I can save a card", "As a shopper, I can pay with a saved card"],
  },
  system: {
    name: "Security baseline",
    description: "What this requirement protects",
    items: ["Secrets are never logged", "Every endpoint requires a session"],
  },
};

/** Ctrl+Enter (Cmd+Enter on a Mac): add another card. */
function isAddCardShortcut(event: KeyboardEvent<HTMLElement>): boolean {
  return event.key === "Enter" && (event.ctrlKey || event.metaKey);
}

/* ── Story rows ─────────────────────────────────────────────────────────── */

interface StoryRowsHandlers {
  edit: (index: number, value: string) => void;
  add: (afterIndex: number) => void;
  remove: (index: number) => void;
  /** True when a multi-line paste was split into rows. */
  paste: (index: number, pasted: string) => boolean;
}

/**
 * A card's first stories (or items), one input per row. Enter adds the next
 * row, Backspace on an empty row removes it, and pasting several lines adds
 * one row per line. Ctrl+Enter is left to the dialog (another card).
 */
function StoryRowsField({
  kind,
  rows,
  handlers,
}: Readonly<{ kind: RequirementKind; rows: string[]; handlers: StoryRowsHandlers }>) {
  const copy = kindCopy(kind);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  /* Which row to focus once the next render has it (after add or remove). */
  const pendingFocus = useRef<number | null>(null);

  useEffect(() => {
    const at = pendingFocus.current;
    if (at === null) return;
    pendingFocus.current = null;
    inputs.current[at]?.focus();
  });

  function addAfter(index: number) {
    pendingFocus.current = index + 1;
    handlers.add(index);
  }

  function remove(index: number) {
    pendingFocus.current = Math.max(0, Math.min(index, rows.length - 2));
    handlers.remove(index);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (isAddCardShortcut(event)) return;
    if (event.key === "Enter") {
      // The dialog is a form: Enter here means "next row", not "create".
      event.preventDefault();
      addAfter(index);
    } else if (event.key === "Backspace" && rows[index] === "" && rows.length > 1) {
      event.preventDefault();
      pendingFocus.current = Math.max(0, index - 1);
      handlers.remove(index);
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>, index: number) {
    if (handlers.paste(index, event.clipboardData.getData("text"))) event.preventDefault();
  }

  return (
    <fieldset className="hier-field rq-story-rows" data-kind={kind}>
      <legend className="hier-field-label">{copy.items} (optional)</legend>
      <ol className="rq-story-rows__list">
        {rows.map((row, index) => (
          // Rows are plain strings; the index is their identity while the dialog is open.
          <li className="rq-story-row" key={index}>
            <span className="rq-story-row__number" aria-hidden="true">
              {index + 1}
            </span>
            <input
              ref={(element) => {
                inputs.current[index] = element;
              }}
              className="hier-input rq-story-row__input"
              aria-label={`${copy.item} ${index + 1}`}
              value={row}
              placeholder={PLACEHOLDERS[kind].items[index] ?? ""}
              onChange={(event) => handlers.edit(index, event.target.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              onPaste={(event) => onPaste(event, index)}
            />
            <button
              type="button"
              className="rq-story-row__remove"
              aria-label={`Remove ${copy.item.toLowerCase()} ${index + 1}`}
              disabled={rows.length === 1 && row === ""}
              onClick={() => remove(index)}
            >
              <RemoveIcon />
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="rq-add" onClick={() => addAfter(rows.length - 1)}>
        <PlusIcon /> {copy.addItem}
      </button>
    </fieldset>
  );
}

/* ── One card: a whole requirement ──────────────────────────────────────── */

function storyHandlers(vm: RequirementDialogViewModel, key: string): StoryRowsHandlers {
  return {
    edit: (index, value) => vm.editCardStory(key, index, value),
    add: (afterIndex) => vm.addCardStory(key, afterIndex),
    remove: (index) => vm.removeCardStory(key, index),
    paste: (index, pasted) => vm.pasteCardStories(key, index, pasted),
  };
}

function RequirementCard({
  vm,
  kind,
  card,
  position,
  domId,
  nameRef,
  onRemove,
}: Readonly<{
  vm: RequirementDialogViewModel;
  kind: RequirementKind;
  card: RequirementCardDraft;
  /** 1-based: "Feature 2". */
  position: number;
  domId: string;
  nameRef: (element: HTMLInputElement | null) => void;
  onRemove: (() => void) | null;
}>) {
  const heading = cardHeading(kind, position);
  const error = vm.cardErrors[card.key] ?? null;
  const errorId = `${domId}-error`;
  return (
    <fieldset className="rq-batch-card" id={domId} data-kind={kind} data-invalid={error ? "true" : undefined}>
      <legend className="rq-batch-card__legend">
        <span className="rq-batch-card__number" aria-hidden="true">
          {position}
        </span>
        {heading}
      </legend>
      {onRemove ? (
        <button type="button" className="rq-batch-card__remove" aria-label={`Remove ${heading}`} onClick={onRemove}>
          <RemoveIcon />
        </button>
      ) : null}
      <label className="hier-field">
        <span className="hier-field-label">Name</span>
        <input
          ref={nameRef}
          className="hier-input"
          value={card.name}
          maxLength={REQUIREMENT_NAME_MAX + 20}
          placeholder={PLACEHOLDERS[kind].name}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => vm.updateCard(card.key, { name: event.target.value })}
        />
      </label>
      <label className="hier-field">
        <span className="hier-field-label">Description (optional)</span>
        <textarea
          className="hier-textarea rq-batch-card__description"
          rows={2}
          value={card.description}
          placeholder={PLACEHOLDERS[kind].description}
          onChange={(event) => vm.updateCard(card.key, { description: event.target.value })}
        />
      </label>
      <StoryRowsField kind={kind} rows={card.stories} handlers={storyHandlers(vm, card.key)} />
      {error ? (
        <p className="rq-form-error rq-batch-card__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** The last grid cell: one obvious click to add another requirement. */
function AddCardTile({
  kind,
  canAdd,
  onAdd,
}: Readonly<{ kind: RequirementKind; canAdd: boolean; onAdd: () => void }>) {
  const noteId = useId();
  return (
    <button
      type="button"
      className="rq-batch-add"
      data-kind={kind}
      disabled={!canAdd}
      aria-keyshortcuts="Control+Enter Meta+Enter"
      aria-describedby={canAdd ? undefined : noteId}
      onClick={onAdd}
    >
      <span className="rq-batch-add__icon" aria-hidden="true">
        <PlusIcon />
      </span>
      <span className="rq-batch-add__label">{addCardLabel(kind)}</span>
      {canAdd ? (
        <span className="rq-batch-add__hint" aria-hidden="true">
          <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
        </span>
      ) : (
        <span className="rq-batch-add__hint" id={noteId}>
          {batchLimitNote(kind)}
        </span>
      )}
    </button>
  );
}

/* ── Create: several at once ────────────────────────────────────────────── */

function cardDomId(baseId: string, key: string): string {
  return `${baseId}-${key}`;
}

/**
 * The cards, two columns wide (one on narrow screens), then the add tile.
 * Adding a card focuses its Name; a failed Create brings the card it names
 * into view and focuses its Name.
 */
function CreateRequirementsBody({
  vm,
  kind,
}: Readonly<{ vm: RequirementDialogViewModel; kind: RequirementKind }>) {
  const baseId = useId();
  const names = useRef(new Map<string, HTMLInputElement>());
  const pendingFocus = useRef<string | null>(null);
  const focusAttempt = vm.cardFocus?.attempt ?? 0;
  const focusKey = vm.cardFocus?.key ?? null;

  useEffect(() => {
    const key = pendingFocus.current;
    if (key === null) return;
    pendingFocus.current = null;
    names.current.get(key)?.focus();
  });

  useEffect(() => {
    if (!focusKey) return;
    const card = document.getElementById(cardDomId(baseId, focusKey));
    card?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    names.current.get(focusKey)?.focus({ preventScroll: true });
  }, [baseId, focusKey, focusAttempt]);

  function add() {
    const key = vm.addCard();
    if (key) pendingFocus.current = key;
  }

  function remove(index: number) {
    const neighbour = vm.cards[index - 1] ?? vm.cards[index + 1];
    if (neighbour) pendingFocus.current = neighbour.key;
    vm.removeCard(vm.cards[index].key);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isAddCardShortcut(event)) return;
    event.preventDefault();
    add();
  }

  const several = vm.cards.length > 1;
  return (
    <div className="rq-batch" data-kind={kind} onKeyDown={onKeyDown}>
      <p className="rq-field-hint rq-batch__hint">
        In a story, Enter adds the next one and pasting a list adds a row per line. Acceptance criteria can be
        added to each one afterwards.
      </p>
      <div className="rq-batch__grid">
        {vm.cards.map((card, index) => (
          <RequirementCard
            key={card.key}
            vm={vm}
            kind={kind}
            card={card}
            position={index + 1}
            domId={cardDomId(baseId, card.key)}
            nameRef={(element) => {
              if (element) names.current.set(card.key, element);
              else names.current.delete(card.key);
            }}
            onRemove={several ? () => remove(index) : null}
          />
        ))}
        <AddCardTile kind={kind} canAdd={vm.canAddCard} onAdd={add} />
      </div>
    </div>
  );
}

function CreateRequirementsDialog({
  vm,
  kind,
}: Readonly<{ vm: RequirementDialogViewModel; kind: RequirementKind }>) {
  const copy = kindCopy(kind);
  const saving = vm.status === "saving";
  return (
    <FormDialog
      open={vm.status === "editing" || saving}
      onClose={vm.close}
      size="wide"
      title={copy.create}
      description={`Add one or several. Each applies to every repository in this Project: Developers track its ${copy.items.toLowerCase()}, and the QA Team verifies them.`}
      submitLabel={vm.submitLabel}
      submitting={saving}
      error={vm.error?.message ?? null}
      onSubmit={() => void vm.submit()}
    >
      <fieldset className="rq-batch__fieldset" disabled={saving}>
        <CreateRequirementsBody vm={vm} kind={kind} />
      </fieldset>
    </FormDialog>
  );
}

/* ── Edit: one requirement ──────────────────────────────────────────────── */

function EditRequirementDialog({
  vm,
  mode,
}: Readonly<{ vm: RequirementDialogViewModel; mode: Extract<RequirementDialogMode, { kind: "edit" }> }>) {
  const kind = mode.requirement.kind;
  const saving = vm.status === "saving";
  return (
    <FormDialog
      open={vm.status === "editing" || saving}
      onClose={vm.close}
      title={`Edit ${kindCopy(kind).singular.toLowerCase()}`}
      submitLabel={vm.submitLabel}
      submitting={saving}
      error={vm.error?.message ?? null}
      onSubmit={() => void vm.submit()}
    >
      <label className="hier-field">
        <span className="hier-field-label">Name</span>
        <input
          className="hier-input"
          value={vm.draft.name}
          maxLength={REQUIREMENT_NAME_MAX + 20}
          disabled={saving}
          placeholder={PLACEHOLDERS[kind].name}
          onChange={(event) => vm.updateDraft({ name: event.target.value })}
        />
      </label>
      <label className="hier-field">
        <span className="hier-field-label">Description (optional)</span>
        <textarea
          className="hier-textarea"
          rows={3}
          value={vm.draft.description}
          disabled={saving}
          placeholder={PLACEHOLDERS[kind].description}
          onChange={(event) => vm.updateDraft({ description: event.target.value })}
        />
      </label>
      {vm.validationError ? (
        <p className="rq-form-error" role="alert">
          {vm.validationError}
        </p>
      ) : null}
    </FormDialog>
  );
}

/**
 * New Feature (or New System requirement): several at once, one card each,
 * sent together. Edit keeps the single-requirement form. Product owners and
 * admins only.
 */
export function RequirementDialog({ vm }: Readonly<{ vm: RequirementDialogViewModel }>) {
  const mode = vm.mode;
  if (!mode || vm.status === "confirm-archive" || vm.status === "archiving") return null;
  if (mode.kind === "create") return <CreateRequirementsDialog vm={vm} kind={mode.requirementKind} />;
  return <EditRequirementDialog vm={vm} mode={mode} />;
}

/** "Archive this requirement?" — it leaves the Project and the next QA run. */
export function ArchiveRequirementDialog({ vm }: Readonly<{ vm: RequirementDialogViewModel }>) {
  const open = vm.status === "confirm-archive" || vm.status === "archiving";
  const mode = vm.mode;
  if (!open || mode?.kind !== "edit") return null;
  const requirement = mode.requirement;
  const copy = kindCopy(requirement.kind);
  return (
    <FormDialog
      open={open}
      onClose={vm.close}
      title={`Archive ${requirement.name}?`}
      description={`The ${copy.singular.toLowerCase()} leaves this Project and the next QA run. Runs already started keep their copy, and signed-off runs stay as they are.`}
      submitLabel="Archive"
      submitting={vm.status === "archiving"}
      error={vm.error?.message ?? null}
      onSubmit={() => void vm.confirmArchive()}
    >
      <p className="rq-note">
        {requirement.items.length} {requirement.items.length === 1 ? copy.item.toLowerCase() : copy.items.toLowerCase()}{" "}
        will be archived with it.
      </p>
    </FormDialog>
  );
}
