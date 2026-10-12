import {
  STALE_CHECKLIST_MESSAGE,
  automatedItemCount,
  blankItemDraft,
  checklistErrorMessage,
  checklistManageHref,
  detailsChanged,
  draftFromChecklist,
  isDraftDirty,
  isStaleConflict,
  itemCountLabel,
  itemsChanged,
  moveItem,
  needsTestIdentifier,
  patchItemByKey,
  removeItemByKey,
  sameProjectSet,
  sharedCountLabel,
  sortChecklists,
  targetPersonaLabel,
  testIdentifierPlaceholder,
  toDetailsInput,
  toItemInputs,
  toggleProjectId,
  updatedLabel,
  upsertChecklist,
  validateChecklistDraft,
  verificationTypeLabel,
} from "../../../../../src/features/checklists/model/checklist-rules";
import { apiError, checklist, checklistItem } from "../checklist-fixtures";

describe("checklist labels", () => {
  it("names personas the way the role badges do", () => {
    expect(targetPersonaLabel("developer")).toBe("Developer");
    expect(targetPersonaLabel("qa")).toBe("QA Team");
    expect(targetPersonaLabel("all")).toBe("Everyone");
  });

  it("names every verification type", () => {
    expect(verificationTypeLabel("manual")).toBe("Manual check");
    expect(verificationTypeLabel("playwright")).toBe("Playwright E2E");
    expect(verificationTypeLabel("unit_test")).toBe("Unit test");
    expect(verificationTypeLabel("bruno")).toBe("Bruno API");
  });

  it("asks for a test identifier only for automated checks", () => {
    expect(needsTestIdentifier("manual")).toBe(false);
    expect(needsTestIdentifier("playwright")).toBe(true);
    expect(testIdentifierPlaceholder("manual")).toBe("");
    expect(testIdentifierPlaceholder("bruno")).toMatch(/\.bru$/);
  });

  it("pluralises counts", () => {
    expect(itemCountLabel(1)).toBe("1 item");
    expect(itemCountLabel(3)).toBe("3 items");
    expect(sharedCountLabel(0)).toBe("Not shared");
    expect(sharedCountLabel(1)).toBe("Shared to 1 project");
    expect(sharedCountLabel(4)).toBe("Shared to 4 projects");
  });

  it("counts automated items", () => {
    expect(automatedItemCount(checklist().items)).toBe(1);
  });

  it("describes when a checklist changed, relative to a fixed now", () => {
    const now = Date.parse("2026-09-25T12:00:00.000Z");
    expect(updatedLabel("2026-09-25T11:59:40.000Z", now)).toBe("Updated just now");
    expect(updatedLabel("2026-09-25T11:55:00.000Z", now)).toBe("Updated 5 minutes ago");
    expect(updatedLabel("2026-09-25T11:00:00.000Z", now)).toBe("Updated 1 hour ago");
    expect(updatedLabel("2026-09-22T12:00:00.000Z", now)).toBe("Updated 3 days ago");
    expect(updatedLabel("2026-06-01T12:00:00.000Z", now)).toBe("Updated 2026-06-01");
    expect(updatedLabel("not a date", now)).toBe("Updated recently");
  });
});

describe("checklist ordering", () => {
  it("puts active checklists first, newest change first", () => {
    const sorted = sortChecklists([
      checklist({ id: "old", updatedAt: "2026-09-01T00:00:00.000Z" }),
      checklist({ id: "archived", archivedAt: "2026-09-24T00:00:00.000Z", updatedAt: "2026-09-24T00:00:00.000Z" }),
      checklist({ id: "new", updatedAt: "2026-09-20T00:00:00.000Z" }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["new", "old", "archived"]);
  });

  it("upserts by id", () => {
    const list = [checklist({ id: "a" }), checklist({ id: "b" })];
    expect(upsertChecklist(list, checklist({ id: "b", name: "Renamed" }))[1].name).toBe("Renamed");
    expect(upsertChecklist(list, checklist({ id: "c" })).map((item) => item.id)).toEqual(["c", "a", "b"]);
  });
});

describe("draft editing", () => {
  it("moves an item up and down and ignores moves off either end", () => {
    const items = ["a", "b", "c"];
    expect(moveItem(items, 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveItem(items, 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(items, 0, -1)).toEqual(items);
    expect(moveItem(items, 2, 1)).toEqual(items);
    expect(moveItem(items, 5, -1)).toEqual(items);
  });

  it("seeds a draft from a checklist in position order", () => {
    const draft = draftFromChecklist(
      checklist({ items: [checklistItem(1, { title: "Second" }), checklistItem(0, { title: "First" })] }),
    );
    expect(draft.items.map((item) => item.title)).toEqual(["First", "Second"]);
    expect(draftFromChecklist(null)).toEqual({ name: "", description: "", items: [] });
  });

  it("patches and removes rows by key", () => {
    const items = [blankItemDraft("a"), blankItemDraft("b")];
    expect(patchItemByKey(items, "b", { title: "Hi" })[1].title).toBe("Hi");
    expect(removeItemByKey(items, "a").map((item) => item.key)).toEqual(["b"]);
  });

  it("serialises items: trims, nulls empties, drops a manual check's test id", () => {
    const inputs = toItemInputs([
      { ...blankItemDraft("a"), title: "  Pay  ", description: "   ", testIdentifier: "left over" },
      { ...blankItemDraft("b"), title: "E2E", verificationType: "playwright", testIdentifier: " e2e/pay.spec.ts " },
    ]);
    expect(inputs[0]).toEqual({
      title: "Pay",
      description: null,
      targetPersona: "all",
      verificationType: "manual",
      testIdentifier: null,
    });
    expect(inputs[1].testIdentifier).toBe("e2e/pay.spec.ts");
    expect(toDetailsInput({ name: " N ", description: "", items: [] })).toEqual({ name: "N", description: null });
  });

  it("validates the name and every item title", () => {
    const invalid = validateChecklistDraft({
      name: " ",
      description: "",
      items: [blankItemDraft("a"), { ...blankItemDraft("b"), title: "ok" }],
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.nameError).toMatch(/name/);
    expect(Object.keys(invalid.itemErrors)).toEqual(["a"]);

    const long = validateChecklistDraft({ name: "x".repeat(121), description: "", items: [] });
    expect(long.nameError).toMatch(/120/);

    expect(validateChecklistDraft({ name: "Fine", description: "", items: [] }).valid).toBe(true);
  });

  it("knows which half of a checklist changed", () => {
    const saved = checklist();
    const draft = draftFromChecklist(saved);
    expect(isDraftDirty(draft, saved)).toBe(false);
    expect(detailsChanged({ ...draft, name: "Other" }, saved)).toBe(true);
    expect(itemsChanged({ ...draft, name: "Other" }, saved)).toBe(false);
    expect(itemsChanged({ ...draft, items: moveItem(draft.items, 0, 1) }, saved)).toBe(true);
    expect(isDraftDirty({ name: "", description: "", items: [] }, null)).toBe(false);
    expect(isDraftDirty({ name: "x", description: "", items: [] }, null)).toBe(true);
  });

  it("toggles and compares project selections", () => {
    expect(toggleProjectId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleProjectId(["a", "b"], "a")).toEqual(["b"]);
    expect(sameProjectSet(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameProjectSet(["a"], ["a", "b"])).toBe(false);
  });
});

describe("checklist links and errors", () => {
  it("links a lead to the Checklists page on the owning team, opened on the checklist", () => {
    expect(checklistManageHref("ws 1")).toBe("/checklists?workspace=ws+1");
    expect(checklistManageHref("ws-1", "cl-1")).toBe(
      "/checklists?workspace=ws-1&checklist=cl-1",
    );
  });

  it("turns a stale-version 409 into the reload message", () => {
    const stale = apiError(409, "Checklist version mismatch");
    expect(checklistErrorMessage(stale, "x")).toBe(STALE_CHECKLIST_MESSAGE);
    expect(isStaleConflict(stale)).toBe(true);
  });

  it("tells the other 409s apart", () => {
    expect(checklistErrorMessage(apiError(409, "A checklist with this name already exists"), "x")).toMatch(/already has a checklist/);
    expect(checklistErrorMessage(apiError(409, "Checklist is archived"), "x")).toMatch(/archived/);
    expect(isStaleConflict(apiError(409, "Checklist is archived"))).toBe(false);
  });

  it("maps role and membership errors, and falls back otherwise", () => {
    expect(checklistErrorMessage(apiError(403), "x")).toMatch(/Product owners and admins/);
    expect(checklistErrorMessage(apiError(404), "x")).toMatch(/no longer exists/);
    expect(checklistErrorMessage(new Error("boom"), "fallback")).toBe("fallback");
    expect(checklistErrorMessage(null, "fallback")).toBe("fallback");
  });
});
