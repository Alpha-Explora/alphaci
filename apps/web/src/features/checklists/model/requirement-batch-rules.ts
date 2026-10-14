/* Pure rules for creating several requirements at once: the New Feature (or
 * New System requirement) dialog holds one card per requirement (an entry in
 * its side list, edited in the pane beside it) and sends
 * them in ONE request to POST /delivery-projects/:dpId/requirements/batch,
 * which creates all of them or none. No React, no fetch.
 *
 * A card is a whole requirement draft (name, description, first stories);
 * its story rows reuse the single-requirement rules in requirement-rules.ts. */

import { qaCodeMessage, isStaleCode } from "./qa-error-messages";
import {
  createRequirementPayload,
  kindCopy,
  REQUIREMENT_ITEM_TITLE_MAX,
  REQUIREMENT_NAME_MAX,
  requirementDraftError,
  requirementError,
  type RequirementError,
} from "./requirement-rules";
import type {
  CreateRequirementBatchInput,
  RequirementCardDraft,
  RequirementDraft,
  RequirementKind,
} from "./requirement-types";
import { errorCode, errorDetails } from "./wire-readers";

/** The backend's batch limit (1..20). */
export const REQUIREMENT_BATCH_MAX = 20;

const KEY_PREFIX = "card-";

/* ── Cards ──────────────────────────────────────────────────────────────── */

export function blankCard(key: string): RequirementCardDraft {
  return { key, name: "", description: "", stories: [""] };
}

/** A fresh dialog: one empty card. */
export function firstCards(): RequirementCardDraft[] {
  return [blankCard(`${KEY_PREFIX}1`)];
}

/** A key no card in the list has: one past the highest numbered key. */
export function nextCardKey(cards: ReadonlyArray<Pick<RequirementCardDraft, "key">>): string {
  let highest = 0;
  for (const card of cards) {
    const number = Number.parseInt(card.key.slice(KEY_PREFIX.length), 10);
    if (card.key.startsWith(KEY_PREFIX) && Number.isFinite(number)) highest = Math.max(highest, number);
  }
  return `${KEY_PREFIX}${highest + 1}`;
}

export function canAddCard(cards: ReadonlyArray<unknown>): boolean {
  return cards.length < REQUIREMENT_BATCH_MAX;
}

/** A blank card appended under `key`; the list unchanged at the limit. */
export function addCard(cards: ReadonlyArray<RequirementCardDraft>, key: string): RequirementCardDraft[] {
  return canAddCard(cards) ? [...cards, blankCard(key)] : [...cards];
}

/** The card removed; the last card left always stays, so there is something to type into. */
export function removeCard(cards: ReadonlyArray<RequirementCardDraft>, key: string): RequirementCardDraft[] {
  const rest = cards.filter((card) => card.key !== key);
  return rest.length > 0 ? rest : [...cards];
}

/** The card with `key` changed by `change`; the others untouched. */
export function updateCard(
  cards: ReadonlyArray<RequirementCardDraft>,
  key: string,
  change: (card: RequirementCardDraft) => RequirementCardDraft,
): RequirementCardDraft[] {
  return cards.map((card) => (card.key === key ? change(card) : card));
}

/** Nothing typed: no name, no description, no story. Ignored on submit. */
export function isBlankCard(card: RequirementDraft): boolean {
  return !card.name.trim() && !card.description.trim() && card.stories.every((row) => !row.trim());
}

/**
 * The cards Create sends, in order: every card with something in it. When
 * all are blank the first is kept, so validation can ask for its name.
 */
export function cardsToSend(cards: ReadonlyArray<RequirementCardDraft>): RequirementCardDraft[] {
  const filled = cards.filter((card) => !isBlankCard(card));
  return filled.length > 0 ? filled : cards.slice(0, 1);
}

function nameKey(card: RequirementDraft): string {
  return card.name.trim().toLowerCase();
}

/**
 * Why each card cannot be sent, by card key: its own draft error (name
 * required, limits, story length), else a name another card above it already
 * uses. Cards that are not sent (blank extras) are never flagged.
 */
export function cardErrors(
  cards: ReadonlyArray<RequirementCardDraft>,
  kind: RequirementKind,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const seen = new Set<string>();
  const singular = kindCopy(kind).singular;
  for (const card of cardsToSend(cards)) {
    const own = requirementDraftError(card, kind);
    const name = nameKey(card);
    if (own) errors[card.key] = own;
    else if (seen.has(name)) errors[card.key] = `Another ${singular} in this dialog already has this name.`;
    seen.add(name);
  }
  return errors;
}

/** The ONE batch body: the sent cards in order, each as a single create would send it. */
export function batchPayload(
  kind: RequirementKind,
  cards: ReadonlyArray<RequirementCardDraft>,
): CreateRequirementBatchInput {
  return {
    kind,
    requirements: cardsToSend(cards).map((card) => {
      const { kind: _kind, ...body } = createRequirementPayload(kind, card);
      return body;
    }),
  };
}

/** The sent cards' keys in request order: the server's `index` points into this. */
export function sentCardKeys(cards: ReadonlyArray<RequirementCardDraft>): string[] {
  return cardsToSend(cards).map((card) => card.key);
}

/* ── Copy ───────────────────────────────────────────────────────────────── */

/** "Create feature" for one, "Create 3 features" for three. Counts what will be sent. */
export function batchSubmitLabel(kind: RequirementKind, cards: ReadonlyArray<RequirementCardDraft>): string {
  const copy = kindCopy(kind);
  const count = cardsToSend(cards).length;
  return count <= 1 ? `Create ${copy.singular.toLowerCase()}` : `Create ${count} ${copy.plural.toLowerCase()}`;
}

/** The side list's add button: "Add feature" / "Add requirement". */
export function addCardLabel(kind: RequirementKind): string {
  return kind === "system" ? "Add requirement" : "Add feature";
}

/** "Feature 2": a card by its position (1-based), when it has no name yet. */
export function cardHeading(kind: RequirementKind, position: number): string {
  return `${kindCopy(kind).singular} ${position}`;
}

/** At the limit, why the add button is off. */
export function batchLimitNote(kind: RequirementKind): string {
  return `Up to ${REQUIREMENT_BATCH_MAX} ${kindCopy(kind).plural.toLowerCase()} at a time.`;
}

/* ── The side list: one entry (tab) per card ───────────────────────────── */

/** An entry with no name yet: "Untitled feature" / "Untitled requirement". */
export function untitledLabel(kind: RequirementKind): string {
  return kind === "system" ? "Untitled requirement" : "Untitled feature";
}

export interface CardTabLabel {
  text: string;
  /** No name typed yet: `text` is the placeholder, shown muted. */
  untitled: boolean;
}

/** A side-list entry's label: the Name as typed (trimmed, runs of spaces as one), else the placeholder. */
export function cardTabLabel(kind: RequirementKind, card: Pick<RequirementDraft, "name">): CardTabLabel {
  const name = card.name.trim().replace(/\s+/g, " ");
  return name ? { text: name, untitled: false } : { text: untitledLabel(kind), untitled: true };
}

/** The stories (or items) a card will send: its non-blank rows. */
export function cardStoryCount(card: Pick<RequirementDraft, "stories">): number {
  return card.stories.filter((row) => row.trim()).length;
}

/** "3 stories", "1 story", "No stories"; "3 items" for a System requirement. */
export function storyCountLabel(kind: RequirementKind, count: number): string {
  const [one, many] = kind === "system" ? ["item", "items"] : ["story", "stories"];
  if (count === 0) return `No ${many}`;
  return `${count} ${count === 1 ? one : many}`;
}

/** "Feature 2 of 5": where the open card sits in the list (`index` is 0-based). */
export function cardPosition(kind: RequirementKind, index: number, total: number): string {
  return `${kindCopy(kind).singular} ${index + 1} of ${total}`;
}

/** The selected key while a card still has it; else the first card's. */
export function resolveSelectedKey(
  cards: ReadonlyArray<Pick<RequirementCardDraft, "key">>,
  selectedKey: string | null,
): string {
  const kept = cards.find((card) => card.key === selectedKey);
  return (kept ?? cards[0])?.key ?? "";
}

/**
 * The entry to select once `removedKey` goes: the selection is kept unless it
 * was the one removed; then the next entry, else the previous one. The last
 * card is never removed, so it stays selected.
 */
export function selectedAfterRemove(
  cards: ReadonlyArray<Pick<RequirementCardDraft, "key">>,
  selectedKey: string | null,
  removedKey: string,
): string {
  const current = resolveSelectedKey(cards, selectedKey);
  if (current !== removedKey || cards.length <= 1) return current;
  const at = cards.findIndex((card) => card.key === removedKey);
  return (cards[at + 1] ?? cards[at - 1]).key;
}

/** Keys that move along the side list: down/up (right/left on the narrow strip). */
const TAB_STEPS: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

/** The entry a key moves to from `index` (wrapping round, Home first, End last); null for any other key. */
export function tabIndexForKey(key: string, index: number, total: number): number | null {
  if (total <= 0) return null;
  if (key === "Home") return 0;
  if (key === "End") return total - 1;
  const step = TAB_STEPS[key];
  return step === undefined ? null : (index + step + total) % total;
}

/** The first card, in list order, that has an error; null when none does. */
export function firstInvalidCardKey(
  cards: ReadonlyArray<Pick<RequirementCardDraft, "key">>,
  errors: Readonly<Record<string, string>>,
): string | null {
  return cards.find((card) => errors[card.key] !== undefined)?.key ?? null;
}

/** Where a card's error is: its Name, or the first story (item) row that is too long. */
export type CardErrorField = { field: "name" } | { field: "story"; row: number };

/**
 * The field to focus for a card's error, in the order requirementDraftError
 * checks them: a missing or long name, then a long story. Anything else (a
 * name another card or the Project already has) belongs to the name.
 */
export function cardErrorField(card: Pick<RequirementDraft, "name" | "stories">): CardErrorField {
  const name = card.name.trim();
  if (!name || name.length > REQUIREMENT_NAME_MAX) return { field: "name" };
  const row = card.stories.findIndex((story) => story.trim().length > REQUIREMENT_ITEM_TITLE_MAX);
  return row >= 0 ? { field: "story", row } : { field: "name" };
}

/** How a sentence names a card: its name in quotes, else "Feature 2" by its place in the list. */
export function cardReference(
  kind: RequirementKind,
  cards: ReadonlyArray<RequirementCardDraft>,
  key: string,
): string {
  const at = cards.findIndex((card) => card.key === key);
  const label = at >= 0 ? cardTabLabel(kind, cards[at]) : null;
  return label && !label.untitled ? `"${label.text}"` : cardHeading(kind, at + 1);
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

/** Codes that name one card by its `index` in the request. */
const CARD_CODES: ReadonlySet<string> = new Set(["REQUIREMENT_BATCH_DUPLICATE_NAME", "REQUIREMENT_NAME_TAKEN"]);

export interface RequirementBatchError extends RequirementError {
  /** The card the server named (by `index`), or null when it named none. */
  cardKey: string | null;
  /** Shown on that card. */
  cardMessage: string | null;
}

function indexedKey(cause: unknown, sentKeys: ReadonlyArray<string>): string | null {
  if (!CARD_CODES.has(errorCode(cause))) return null;
  const index = errorDetails(cause)?.index;
  return typeof index === "number" && Number.isInteger(index) ? (sentKeys[index] ?? null) : null;
}

/**
 * A failed batch create to sentences. Nothing was created (all or nothing).
 * When the server names a card by `index`, the reason goes on that card and
 * the dialog says which one to fix, by its name when it has one.
 */
export function requirementBatchError(
  cause: unknown,
  kind: RequirementKind,
  cards: ReadonlyArray<RequirementCardDraft>,
  fallback: string,
): RequirementBatchError {
  const cardKey = indexedKey(cause, sentCardKeys(cards));
  if (!cardKey) return { ...requirementError(cause, fallback), cardKey: null, cardMessage: null };
  // Named as the side list shows it: by its name, else by its place in the list.
  return {
    message: `Nothing was created. Fix ${cardReference(kind, cards, cardKey)}, then try again.`,
    stale: isStaleCode(cause),
    cardKey,
    cardMessage: qaCodeMessage(cause) ?? fallback,
  };
}
