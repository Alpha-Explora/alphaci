"use client";

import { useState } from "react";

import { requirementsRepository } from "../../data/requirements-repository";
import {
  addCard as addCardRule,
  batchPayload,
  batchSubmitLabel,
  canAddCard,
  cardErrorField,
  cardErrors as cardErrorsRule,
  firstCards,
  firstInvalidCardKey,
  nextCardKey,
  removeCard as removeCardRule,
  requirementBatchError,
  resolveSelectedKey,
  selectedAfterRemove,
  updateCard as updateCardRule,
  type CardErrorField,
} from "../../model/requirement-batch-rules";
import {
  addStoryRow,
  blankRequirementDraft,
  editStoryRow,
  pasteIntoStoryRows,
  removeStoryRow,
  requirementDraftError,
  requirementDraftFrom,
  requirementError,
  updateRequirementPayload,
  type RequirementError,
} from "../../model/requirement-rules";
import type {
  Requirement,
  RequirementCardDraft,
  RequirementDraft,
  RequirementKind,
} from "../../model/requirement-types";

export type RequirementDialogStatus = "closed" | "editing" | "saving" | "confirm-archive" | "archiving";

export type RequirementDialogMode =
  | { kind: "create"; requirementKind: RequirementKind }
  | { kind: "edit"; requirement: Requirement };

/** The card a failed Create points at, the field to focus in it, and which failure it was (to focus once per failure). */
export interface CardFocus {
  key: string;
  field: CardErrorField;
  attempt: number;
}

type CardText = Partial<Pick<RequirementDraft, "name" | "description">>;

export interface RequirementDialogViewModel {
  status: RequirementDialogStatus;
  mode: RequirementDialogMode | null;
  /** Edit: the one requirement's name and description. */
  draft: RequirementDraft;
  updateDraft: (patch: Partial<RequirementDraft>) => void;
  /** Create: one card per requirement, in order (the side list). Never empty. */
  cards: RequirementCardDraft[];
  /** Create: the card open in the editor pane (the selected entry of the side list). */
  selectedKey: string;
  selectCard: (key: string) => void;
  /** Why a card cannot be sent, by card key: once Create was tried, or from the server. */
  cardErrors: Readonly<Record<string, string>>;
  canAddCard: boolean;
  /** A blank card at the end, selected; its key (to focus its Name), or null at the limit. */
  addCard: () => string | null;
  /** Removes the card; when it was the open one, its neighbour opens (the next, else the previous). */
  removeCard: (key: string) => void;
  updateCard: (key: string, patch: CardText) => void;
  /* A card's first stories (or items), one row each. */
  editCardStory: (key: string, index: number, value: string) => void;
  /** A blank row after `afterIndex` (the end by default). */
  addCardStory: (key: string, afterIndex?: number) => void;
  removeCardStory: (key: string, index: number) => void;
  /** True when a multi-line paste was split into rows (the input should not take it). */
  pasteCardStories: (key: string, index: number, pasted: string) => boolean;
  /** "Create feature", "Create 3 features"; "Save" when editing. */
  submitLabel: string;
  /** The card (now open) and field to focus after a failed Create, or null. */
  cardFocus: CardFocus | null;
  /** Edit: why the draft cannot be sent. Shown once Save was tried. */
  validationError: string | null;
  error: RequirementError | null;
  openCreate: (kind: RequirementKind) => void;
  openEdit: (requirement: Requirement) => void;
  /** Ask before archiving: it leaves the Project and the next QA run. */
  openArchive: (requirement: Requirement) => void;
  close: () => void;
  submit: () => Promise<void>;
  confirmArchive: () => Promise<void>;
}

const SAVE_ERROR = "The requirement could not be saved. Try again in a moment.";
const CREATE_ERROR = "Nothing was created. Try again in a moment.";
const ARCHIVE_ERROR = "The requirement could not be archived. Try again in a moment.";

interface ServerCardError {
  key: string;
  message: string;
}

function editValidation(
  attempted: boolean,
  mode: RequirementDialogMode | null,
  draft: RequirementDraft,
): string | null {
  if (!attempted || mode?.kind !== "edit") return null;
  return requirementDraftError(draft, mode.requirement.kind);
}

function visibleCardErrors(
  attempted: boolean,
  mode: RequirementDialogMode | null,
  cards: RequirementCardDraft[],
  server: ServerCardError | null,
): Record<string, string> {
  const errors: Record<string, string> =
    attempted && mode?.kind === "create" ? cardErrorsRule(cards, mode.requirementKind) : {};
  if (server && !errors[server.key] && cards.some((card) => card.key === server.key)) {
    errors[server.key] = server.message;
  }
  return errors;
}

function submitLabelFor(mode: RequirementDialogMode | null, cards: RequirementCardDraft[]): string {
  return mode?.kind === "create" ? batchSubmitLabel(mode.requirementKind, cards) : "Save";
}

/**
 * ViewModel for the requirement dialog (Product owner, admin): create
 * several Features (or System requirements) at once — one entry each in a
 * side list, the selected one open in an editor pane, with its first
 * stories — in ONE all-or-nothing request; rename or re-describe
 * one; or archive it. An edit carries the version read, so two Product
 * owners editing at once get a 409 instead of silently overwriting each other.
 */
export function useRequirementDialogViewModel(options: {
  deliveryProjectId: string;
  onSaved: (requirement: Requirement) => void;
}): RequirementDialogViewModel {
  const { deliveryProjectId, onSaved } = options;
  const [mode, setMode] = useState<RequirementDialogMode | null>(null);
  const [archiving, setArchiving] = useState<Requirement | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<RequirementDraft>(blankRequirementDraft);
  const [cards, setCards] = useState<RequirementCardDraft[]>(firstCards);
  const [selected, setSelected] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<RequirementError | null>(null);
  const [serverCardError, setServerCardError] = useState<ServerCardError | null>(null);
  const [cardFocus, setCardFocus] = useState<CardFocus | null>(null);

  function reset() {
    setAttempted(false);
    setError(null);
    setServerCardError(null);
    setCardFocus(null);
  }

  function openCreate(requirementKind: RequirementKind) {
    setArchiving(null);
    setMode({ kind: "create", requirementKind });
    const fresh = firstCards();
    setCards(fresh);
    setSelected(fresh[0].key);
    reset();
  }

  function openEdit(requirement: Requirement) {
    setArchiving(null);
    setMode({ kind: "edit", requirement });
    setDraft(requirementDraftFrom(requirement));
    reset();
  }

  function openArchive(requirement: Requirement) {
    setMode(null);
    setArchiving(requirement);
    reset();
  }

  function close() {
    if (busy) return;
    setMode(null);
    setArchiving(null);
  }

  /** Opens the card a failed Create names and asks the view to focus `field` in it. */
  function pointAt(key: string, field: CardErrorField) {
    setSelected(key);
    setCardFocus((previous) => ({ key, field, attempt: (previous?.attempt ?? 0) + 1 }));
  }

  async function write(task: () => Promise<Requirement | null>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      const saved = await task();
      if (saved) onSaved(saved);
      setMode(null);
      setArchiving(null);
    } catch (cause) {
      setError(requirementError(cause, fallback));
    } finally {
      setBusy(false);
    }
  }

  async function createAll(kind: RequirementKind) {
    const invalid = firstInvalidCardKey(cards, cardErrorsRule(cards, kind));
    const invalidCard = cards.find((card) => card.key === invalid);
    if (invalidCard) {
      pointAt(invalidCard.key, cardErrorField(invalidCard));
      return;
    }
    const sent = cards;
    setBusy(true);
    setError(null);
    setServerCardError(null);
    try {
      const created = await requirementsRepository.createBatch(deliveryProjectId, batchPayload(kind, sent));
      created.forEach(onSaved);
      setMode(null);
    } catch (cause) {
      const failure = requirementBatchError(cause, kind, sent, CREATE_ERROR);
      setError({ message: failure.message, stale: failure.stale });
      if (failure.cardKey && failure.cardMessage) {
        setServerCardError({ key: failure.cardKey, message: failure.cardMessage });
        // The server names a card by its name: taken, or a duplicate.
        pointAt(failure.cardKey, { field: "name" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!mode || busy) return;
    setAttempted(true);
    if (mode.kind === "create") {
      await createAll(mode.requirementKind);
      return;
    }
    if (requirementDraftError(draft, mode.requirement.kind)) return;
    const target = mode.requirement;
    const body = updateRequirementPayload(target, draft);
    await write(async () => (body ? requirementsRepository.update(target.id, body) : null), SAVE_ERROR);
  }

  async function confirmArchive() {
    if (!archiving || busy) return;
    const target = archiving;
    await write(() => requirementsRepository.archive(target.id), ARCHIVE_ERROR);
  }

  function changeCard(key: string, change: (card: RequirementCardDraft) => RequirementCardDraft) {
    setCards((current) => updateCardRule(current, key, change));
  }

  function setStories(key: string, next: (rows: string[]) => string[]) {
    changeCard(key, (card) => ({ ...card, stories: next(card.stories) }));
  }

  function addCard(): string | null {
    if (!canAddCard(cards)) return null;
    const key = nextCardKey(cards);
    setCards((current) => addCardRule(current, key));
    setSelected(key);
    return key;
  }

  function removeCard(key: string) {
    setSelected(selectedAfterRemove(cards, selected, key));
    setCards((current) => removeCardRule(current, key));
  }

  function updateCard(key: string, patch: CardText) {
    // The server's complaint was about the name as sent; a new name retires it.
    if (patch.name !== undefined) setServerCardError((current) => (current?.key === key ? null : current));
    changeCard(key, (card) => ({ ...card, ...patch }));
  }

  function pasteCardStories(key: string, index: number, pasted: string): boolean {
    const card = cards.find((entry) => entry.key === key);
    const rows = card ? pasteIntoStoryRows(card.stories, index, pasted) : null;
    if (!rows) return false;
    setStories(key, () => rows);
    return true;
  }

  function status(): RequirementDialogStatus {
    if (archiving) return busy ? "archiving" : "confirm-archive";
    if (!mode) return "closed";
    return busy ? "saving" : "editing";
  }

  return {
    status: status(),
    mode: archiving ? { kind: "edit", requirement: archiving } : mode,
    draft,
    updateDraft: (patch) => setDraft((current) => ({ ...current, ...patch })),
    cards,
    selectedKey: resolveSelectedKey(cards, selected),
    selectCard: setSelected,
    cardErrors: visibleCardErrors(attempted, mode, cards, serverCardError),
    canAddCard: canAddCard(cards),
    addCard,
    removeCard,
    updateCard,
    editCardStory: (key, index, value) => setStories(key, (rows) => editStoryRow(rows, index, value)),
    addCardStory: (key, afterIndex) => setStories(key, (rows) => addStoryRow(rows, afterIndex)),
    removeCardStory: (key, index) => setStories(key, (rows) => removeStoryRow(rows, index)),
    pasteCardStories,
    submitLabel: submitLabelFor(mode, cards),
    cardFocus,
    validationError: editValidation(attempted, mode, draft),
    error,
    openCreate,
    openEdit,
    openArchive,
    close,
    submit,
    confirmArchive,
  };
}
