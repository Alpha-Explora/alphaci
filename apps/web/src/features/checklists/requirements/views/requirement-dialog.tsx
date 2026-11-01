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
  cardErrorField,
  cardPosition,
  cardStoryCount,
  cardTabLabel,
  storyCountLabel,
  tabIndexForKey,
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

/** Ctrl+Enter (Cmd+Enter on a Mac): add another requirement. */
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
 * A requirement's first stories (or items), one input per row. Enter adds
 * the next row, Backspace on an empty row removes it, and pasting several
 * lines adds one row per line. Ctrl+Enter is left to the dialog (another
 * requirement). `invalidRow` is the row the open error is about.
 */
function StoryRowsField({
  kind,
  rows,
  handlers,
  invalidRow,
  errorId,
}: Readonly<{
  kind: RequirementKind;
  rows: string[];
  handlers: StoryRowsHandlers;
  invalidRow: number | null;
  errorId: string;
}>) {
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
              aria-invalid={invalidRow === index ? true : undefined}
              aria-describedby={invalidRow === index ? errorId : undefined}
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

/* ── The side list: one tab per requirement ─────────────────────────────── */

function storyHandlers(vm: RequirementDialogViewModel, key: string): StoryRowsHandlers {
  return {
    edit: (index, value) => vm.editCardStory(key, index, value),
    add: (afterIndex) => vm.addCardStory(key, afterIndex),
    remove: (index) => vm.removeCardStory(key, index),
    paste: (index, pasted) => vm.pasteCardStories(key, index, pasted),
  };
}

/** A boolean as a data attribute: present ("true") or absent, for CSS. */
function dataFlag(on: boolean): "true" | undefined {
  return on ? "true" : undefined;
}

function tabDomId(baseId: string, key: string): string {
  return `${baseId}-tab-${key}`;
}

/**
 * One entry of the side list, like a browser's vertical tab: the name as
 * typed (or "Untitled feature"), its story count, an error marker, and a
 * close button of its own beside the tab (never on the only entry).
 */
function RequirementTab({
  kind,
  card,
  position,
  selected,
  invalid,
  tabId,
  paneId,
  tabRef,
  onSelect,
  onKeyDown,
  onRemove,
}: Readonly<{
  kind: RequirementKind;
  card: RequirementCardDraft;
  /** 1-based. */
  position: number;
  selected: boolean;
  invalid: boolean;
  tabId: string;
  paneId: string;
  tabRef: (element: HTMLButtonElement | null) => void;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onRemove: (() => void) | null;
}>) {
  const label = cardTabLabel(kind, card);
  const count = cardStoryCount(card);
  return (
    <div
      className="rq-rail__entry"
      data-selected={dataFlag(selected)}
      data-invalid={dataFlag(invalid)}
      data-removable={dataFlag(onRemove !== null)}
    >
      <button
        ref={tabRef}
        type="button"
        role="tab"
        id={tabId}
        className="rq-rail__tab"
        aria-selected={selected}
        aria-controls={paneId}
        tabIndex={selected ? 0 : -1}
        title={label.text}
        onClick={onSelect}
        onKeyDown={onKeyDown}
      >
        <span className="rq-rail__marker" aria-hidden="true">
          {invalid ? "!" : position}
        </span>
        <span className="rq-rail__name" data-untitled={dataFlag(label.untitled)}>
          {label.text}
        </span>
        {count > 0 ? (
          <span className="rq-rail__count" aria-hidden="true" title={storyCountLabel(kind, count)}>
            {count}
          </span>
        ) : null}
        <span className="sr-only">
          , {storyCountLabel(kind, count)}
          {invalid ? ", needs a fix" : ""}
        </span>
      </button>
      {onRemove ? (
        <button
          type="button"
          className="rq-rail__close"
          aria-label={`Remove ${label.text}`}
          title={`Remove ${label.text}`}
          tabIndex={selected ? 0 : -1}
          onClick={onRemove}
        >
          <RemoveIcon />
        </button>
      ) : null}
    </div>
  );
}

/** The add button pinned at the foot of the side list (the end of the strip on narrow screens). */
function AddRequirementButton({
  kind,
  canAdd,
  onAdd,
}: Readonly<{ kind: RequirementKind; canAdd: boolean; onAdd: () => void }>) {
  const noteId = useId();
  const label = addCardLabel(kind);
  return (
    <div className="rq-rail__foot">
      <button
        type="button"
        className="rq-rail__add"
        disabled={!canAdd}
        title={canAdd ? `${label} (Ctrl+Enter)` : batchLimitNote(kind)}
        aria-keyshortcuts="Control+Enter Meta+Enter"
        aria-describedby={canAdd ? undefined : noteId}
        onClick={onAdd}
      >
        <span className="rq-rail__add-icon" aria-hidden="true">
          <PlusIcon />
        </span>
        <span className="rq-rail__add-label">{label}</span>
        <span className="rq-rail__add-hint" aria-hidden="true">
          <kbd>Ctrl</kbd>
          <kbd>Enter</kbd>
        </span>
      </button>
      {canAdd ? null : (
        <p className="rq-rail__limit" id={noteId}>
          {batchLimitNote(kind)}
        </p>
      )}
    </div>
  );
}

/* ── The editor pane: the selected requirement ──────────────────────────── */

function RequirementPane({
  vm,
  kind,
  card,
  index,
  errorId,
  nameRef,
}: Readonly<{
  vm: RequirementDialogViewModel;
  kind: RequirementKind;
  card: RequirementCardDraft;
  /** 0-based. */
  index: number;
  errorId: string;
  nameRef: (element: HTMLInputElement | null) => void;
}>) {
  const error = vm.cardErrors[card.key] ?? null;
  const field = error ? cardErrorField(card) : null;
  const nameInvalid = field?.field === "name";
  return (
    <div className="rq-pane__body" data-invalid={dataFlag(error !== null)}>
      <p className="rq-pane__position">{cardPosition(kind, index, vm.cards.length)}</p>
      <label className="hier-field">
        <span className="hier-field-label">Name</span>
        <input
          ref={nameRef}
          className="hier-input"
          value={card.name}
          maxLength={REQUIREMENT_NAME_MAX + 20}
          placeholder={PLACEHOLDERS[kind].name}
          aria-invalid={nameInvalid ? true : undefined}
          aria-describedby={nameInvalid ? errorId : undefined}
          data-autofocus
          onChange={(event) => vm.updateCard(card.key, { name: event.target.value })}
        />
      </label>
      <label className="hier-field">
        <span className="hier-field-label">Description (optional)</span>
        <textarea
          className="hier-textarea rq-pane__description"
          rows={3}
          value={card.description}
          placeholder={PLACEHOLDERS[kind].description}
          onChange={(event) => vm.updateCard(card.key, { description: event.target.value })}
        />
      </label>
      <StoryRowsField
        kind={kind}
        rows={card.stories}
        handlers={storyHandlers(vm, card.key)}
        invalidRow={field?.field === "story" ? field.row : null}
        errorId={errorId}
      />
      {error ? (
        <p className="rq-form-error rq-pane__error" id={errorId}>
          {error}
        </p>
      ) : null}
      <p className="rq-field-hint rq-pane__hint">
        In a story, Enter adds the next one and pasting a list adds a row per line. Acceptance criteria can be
        added to each one afterwards.
      </p>
    </div>
  );
}

/* ── Create: several at once ────────────────────────────────────────────── */

/** After the next render: focus the open requirement's Name, or the selected tab. */
type PendingFocus = "name" | "tab" | null;

/**
 * Master-detail: the side list of requirements on the left (a vertical
 * tablist, its add button pinned at the foot), the selected one's editor on
 * the right. Each side scrolls on its own. Adding opens the new one and
 * focuses its Name; a failed Create opens the one it names and focuses the
 * field at fault.
 */
function CreateRequirementsBody({
  vm,
  kind,
}: Readonly<{ vm: RequirementDialogViewModel; kind: RequirementKind }>) {
  const baseId = useId();
  const paneId = `${baseId}-pane`;
  const errorId = `${baseId}-error`;
  const tabs = useRef(new Map<string, HTMLButtonElement>());
  const nameInput = useRef<HTMLInputElement | null>(null);
  const pane = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<PendingFocus>(null);
  const cardFocus = vm.cardFocus;
  const selectedIndex = Math.max(
    0,
    vm.cards.findIndex((card) => card.key === vm.selectedKey),
  );
  const selected = vm.cards[selectedIndex];

  /* A newly opened requirement starts at the top of the pane, and its tab is
     brought into view in the list (a long list scrolls on its own). */
  useEffect(() => {
    if (pane.current) pane.current.scrollTop = 0;
    tabs.current.get(vm.selectedKey)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [vm.selectedKey]);

  useEffect(() => {
    const what = pendingFocus.current;
    if (what === null) return;
    pendingFocus.current = null;
    if (what === "name") nameInput.current?.focus();
    else tabs.current.get(vm.selectedKey)?.focus();
  });

  useEffect(() => {
    if (!cardFocus) return;
    const target =
      cardFocus.field.field === "name"
        ? nameInput.current
        : pane.current?.querySelectorAll<HTMLInputElement>(".rq-story-row__input")[cardFocus.field.row];
    target?.scrollIntoView?.({ block: "nearest" });
    target?.focus({ preventScroll: true });
  }, [cardFocus]);

  function select(key: string) {
    if (key === vm.selectedKey) {
      tabs.current.get(key)?.focus();
      return;
    }
    pendingFocus.current = "tab";
    vm.selectCard(key);
  }

  function add() {
    if (vm.addCard()) pendingFocus.current = "name";
  }

  function remove(key: string) {
    pendingFocus.current = "tab";
    vm.removeCard(key);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (isAddCardShortcut(event)) return;
    const next = tabIndexForKey(event.key, index, vm.cards.length);
    if (next === null) return;
    event.preventDefault();
    select(vm.cards[next].key);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isAddCardShortcut(event)) return;
    event.preventDefault();
    add();
  }

  const several = vm.cards.length > 1;
  return (
    <div className="rq-batch" data-kind={kind} onKeyDown={onKeyDown}>
      <div className="rq-rail">
        <div
          className="rq-rail__tabs"
          role="tablist"
          aria-orientation="vertical"
          aria-label={kindCopy(kind).plural}
        >
          {vm.cards.map((card, index) => (
            <RequirementTab
              key={card.key}
              kind={kind}
              card={card}
              position={index + 1}
              selected={card.key === selected.key}
              invalid={vm.cardErrors[card.key] !== undefined}
              tabId={tabDomId(baseId, card.key)}
              paneId={paneId}
              tabRef={(element) => {
                if (element) tabs.current.set(card.key, element);
                else tabs.current.delete(card.key);
              }}
              onSelect={() => select(card.key)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              onRemove={several ? () => remove(card.key) : null}
            />
          ))}
        </div>
        <AddRequirementButton kind={kind} canAdd={vm.canAddCard} onAdd={add} />
      </div>
      <div
        ref={pane}
        className="rq-pane"
        role="tabpanel"
        id={paneId}
        aria-labelledby={tabDomId(baseId, selected.key)}
      >
        <RequirementPane
          // A new pane per requirement: its story rows start fresh, and it fades in.
          key={selected.key}
          vm={vm}
          kind={kind}
          card={selected}
          index={selectedIndex}
          errorId={errorId}
          nameRef={(element) => {
            nameInput.current = element;
          }}
        />
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
 * New Feature (or New System requirement): several at once, a side list of
 * them beside one editor, sent together. Edit keeps the single-requirement
 * form. Product owners and admins only.
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
      description={`The ${copy.singular.toLowerCase()} leaves this Project and future QA testing. Testing already under way keeps its copy, and signed-off testing stays as it is.`}
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
