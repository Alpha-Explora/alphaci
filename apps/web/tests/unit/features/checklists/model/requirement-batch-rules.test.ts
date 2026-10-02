import {
  addCard,
  addCardLabel,
  batchLimitNote,
  batchPayload,
  batchSubmitLabel,
  blankCard,
  canAddCard,
  cardErrors,
  cardHeading,
  cardsToSend,
  firstCards,
  isBlankCard,
  nextCardKey,
  removeCard,
  REQUIREMENT_BATCH_MAX,
  requirementBatchError,
  sentCardKeys,
  updateCard,
} from "../../../../../src/features/checklists/model/requirement-batch-rules";
import type { RequirementCardDraft } from "../../../../../src/features/checklists/model/requirement-types";
import { apiErrorWith } from "../qa-promotion-fixtures";

function card(key: string, patch: Partial<RequirementCardDraft> = {}): RequirementCardDraft {
  return { ...blankCard(key), ...patch };
}

describe("requirement cards", () => {
  it("starts with one blank card and adds under fresh keys", () => {
    const cards = firstCards();
    expect(cards).toEqual([{ key: "card-1", name: "", description: "", stories: [""] }]);
    expect(nextCardKey(cards)).toBe("card-2");
    // Keys keep growing past a removed card: never reused while the dialog is open.
    expect(nextCardKey([card("card-1"), card("card-4")])).toBe("card-5");
    expect(addCard(cards, "card-2").map((entry) => entry.key)).toEqual(["card-1", "card-2"]);
  });

  it("stops adding at the batch limit", () => {
    const full = Array.from({ length: REQUIREMENT_BATCH_MAX }, (_, index) => card(`card-${index + 1}`));
    expect(REQUIREMENT_BATCH_MAX).toBe(20);
    expect(canAddCard(full)).toBe(false);
    expect(canAddCard(full.slice(1))).toBe(true);
    expect(addCard(full, "card-21")).toHaveLength(20);
  });

  it("removes a card but never the last one", () => {
    const cards = [card("card-1"), card("card-2")];
    expect(removeCard(cards, "card-1").map((entry) => entry.key)).toEqual(["card-2"]);
    expect(removeCard([card("card-1")], "card-1").map((entry) => entry.key)).toEqual(["card-1"]);
  });

  it("changes only the card it names", () => {
    const cards = [card("card-1"), card("card-2")];
    const next = updateCard(cards, "card-2", (entry) => ({ ...entry, name: "Refunds" }));
    expect(next.map((entry) => entry.name)).toEqual(["", "Refunds"]);
    expect(next[0]).toBe(cards[0]);
  });

  it("treats a card with nothing typed (blank story rows included) as blank", () => {
    expect(isBlankCard(card("card-1", { stories: ["", "  "] }))).toBe(true);
    expect(isBlankCard(card("card-1", { description: "why" }))).toBe(false);
    expect(isBlankCard(card("card-1", { stories: ["", "Pay"] }))).toBe(false);
  });

  it("sends every card with something in it, ignoring fully empty extras", () => {
    const cards = [card("card-1", { name: "Wallet" }), card("card-2"), card("card-3", { name: "Refunds" })];
    expect(cardsToSend(cards).map((entry) => entry.key)).toEqual(["card-1", "card-3"]);
    expect(sentCardKeys(cards)).toEqual(["card-1", "card-3"]);
    // All blank: the first is kept so validation can ask for its name.
    expect(cardsToSend([card("card-1"), card("card-2")]).map((entry) => entry.key)).toEqual(["card-1"]);
  });
});

describe("cardErrors", () => {
  it("asks the first card for a name when nothing was typed", () => {
    expect(cardErrors([card("card-1"), card("card-2")], "functional")).toEqual({
      "card-1": "Give the Feature a name.",
    });
  });

  it("flags each card's own problems: a missing name with stories, a long name, a long story", () => {
    const errors = cardErrors(
      [
        card("card-1", { stories: ["Pay"] }),
        card("card-2", { name: "x".repeat(201) }),
        card("card-3", { name: "Fine", stories: ["y".repeat(301)] }),
        card("card-4", { name: "Also fine" }),
      ],
      "functional",
    );
    expect(errors).toEqual({
      "card-1": "Give the Feature a name.",
      "card-2": "Keep the name under 200 characters.",
      "card-3": "Keep each user story under 300 characters.",
    });
  });

  it("flags a name another card above already uses (case and spaces aside)", () => {
    const errors = cardErrors(
      [card("card-1", { name: "Wallet" }), card("card-2", { name: " wallet " }), card("card-3", { name: "Refunds" })],
      "functional",
    );
    expect(errors).toEqual({ "card-2": "Another Feature in this dialog already has this name." });
  });

  it("speaks the System requirement's words", () => {
    expect(cardErrors([card("card-1", { description: "x" })], "system")).toEqual({
      "card-1": "Give the System requirement a name.",
    });
  });
});

describe("batchPayload", () => {
  it("sends one body of the sent cards, each like a single create, in order", () => {
    const cards = [
      card("card-1", { name: " Wallet ", description: " Why ", stories: ["Save a card", "", " Pay "] }),
      card("card-2"),
      card("card-3", { name: "Refunds" }),
    ];
    expect(batchPayload("functional", cards)).toEqual({
      kind: "functional",
      requirements: [
        { name: "Wallet", description: "Why", items: [{ title: "Save a card" }, { title: "Pay" }] },
        { name: "Refunds" },
      ],
    });
  });
});

describe("copy", () => {
  it("counts what will be created in the submit label", () => {
    expect(batchSubmitLabel("functional", [card("card-1")])).toBe("Create feature");
    expect(batchSubmitLabel("functional", [card("card-1", { name: "A" }), card("card-2")])).toBe("Create feature");
    expect(
      batchSubmitLabel("functional", [card("card-1", { name: "A" }), card("card-2", { name: "B" }), card("card-3", { name: "C" })]),
    ).toBe("Create 3 features");
    expect(batchSubmitLabel("system", [card("card-1")])).toBe("Create system requirement");
    expect(batchSubmitLabel("system", [card("card-1", { name: "A" }), card("card-2", { name: "B" })])).toBe(
      "Create 2 system requirements",
    );
  });

  it("names the add tile, the cards and the limit", () => {
    expect(addCardLabel("functional")).toBe("Add another Feature");
    expect(addCardLabel("system")).toBe("Add another System requirement");
    expect(cardHeading("functional", 2)).toBe("Feature 2");
    expect(batchLimitNote("functional")).toBe("Up to 20 features at a time.");
  });
});

describe("requirementBatchError", () => {
  const cards = [card("card-1", { name: "Wallet" }), card("card-2"), card("card-3", { name: "Checkout" })];

  it("puts a taken name on the card the server's index names, numbered as on screen", () => {
    // index 1 is the second card SENT: card-3, the third on screen (card-2 is blank).
    const failure = requirementBatchError(
      apiErrorWith(409, { code: "REQUIREMENT_NAME_TAKEN", index: 1 }),
      "functional",
      cards,
      "fallback",
    );
    expect(failure).toEqual({
      message: "Nothing was created. Fix Feature 3, then try again.",
      stale: false,
      cardKey: "card-3",
      cardMessage: "This Project already has a requirement with that name. Pick another name.",
    });
  });

  it("puts a duplicate the server caught on its card", () => {
    const failure = requirementBatchError(
      apiErrorWith(400, { code: "REQUIREMENT_BATCH_DUPLICATE_NAME", index: 0 }),
      "functional",
      cards,
      "fallback",
    );
    expect(failure.cardKey).toBe("card-1");
    expect(failure.cardMessage).toMatch(/same name/);
  });

  it("keeps the dialog-level sentence when no usable index came back", () => {
    for (const details of [
      { code: "REQUIREMENT_NAME_TAKEN" },
      { code: "REQUIREMENT_NAME_TAKEN", index: 9 },
      { code: "REQUIREMENT_NAME_TAKEN", index: "1" },
    ]) {
      const failure = requirementBatchError(apiErrorWith(409, details), "functional", cards, "fallback");
      expect(failure.cardKey).toBeNull();
      expect(failure.message).toMatch(/already has a requirement with that name/);
    }
    const invalid = requirementBatchError(apiErrorWith(400, { code: "REQUIREMENT_BATCH_INVALID" }), "functional", cards, "fallback");
    expect(invalid).toEqual({
      message: "These requirements could not be created as written. Check each name and story, then try again.",
      stale: false,
      cardKey: null,
      cardMessage: null,
    });
    expect(requirementBatchError(apiErrorWith(403, {}), "functional", cards, "fallback").message).toBe(
      "Your role cannot make this change.",
    );
    expect(requirementBatchError(new Error("offline"), "functional", cards, "fallback").message).toBe("fallback");
  });
});
