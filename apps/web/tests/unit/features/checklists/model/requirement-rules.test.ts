import {
  blankItemDraft,
  blankRequirementDraft,
  canManageRequirements,
  canReopenProjectRun,
  canSetProgress,
  canSetVerification,
  countProgress,
  createItemPayload,
  createRequirementPayload,
  donePercent,
  itemDraftFromRequirementItem,
  itemProgressEditable,
  kindCopy,
  normalizeProgressResult,
  normalizeProjectRequirements,
  normalizeRequirement,
  normalizeRequirementItem,
  progressLabel,
  progressSummaryLabel,
  progressTone,
  removeRequirementItem,
  reorderedItemIds,
  requirementCountLabel,
  requirementCountsByProject,
  requirementDraftError,
  requirementDraftFrom,
  requirementError,
  requirementItemDraftError,
  requirementsOfKind,
  resolveFlag,
  resolveRequirementPermissions,
  addStoryRow,
  editStoryRow,
  pasteIntoStoryRows,
  removeStoryRow,
  storiesFromRows,
  updateItemPayload,
  updateRequirementPayload,
  upsertRequirement,
  upsertRequirementItem,
  withItemOrder,
} from "../../../../../src/features/checklists/model/requirement-rules";
import type { Requirement } from "../../../../../src/features/checklists/model/requirement-types";
import type { AppRole } from "../../../../../src/shared/api/contracts";
import { apiErrorWith } from "../qa-promotion-fixtures";
import { itemWire, projectRequirementsWire, requirementWire, systemRequirementWire } from "../requirement-fixtures";

function requirement(overrides = {}): Requirement {
  return normalizeRequirement(requirementWire(overrides))!;
}

const ROLES: Array<AppRole | null | undefined> = ["admin", "lead", "qa", "member", null, undefined];

describe("who may do what (allow-lists, section 4.1)", () => {
  it.each(ROLES)("matches the backend rules for %p", (role) => {
    expect(canManageRequirements(role)).toBe(role === "lead" || role === "admin");
    expect(canSetProgress(role)).toBe(role === "member" || role === "lead" || role === "admin");
    expect(canSetVerification(role)).toBe(role === "qa" || role === "lead" || role === "admin");
    expect(canReopenProjectRun(role)).toBe(role === "lead" || role === "admin");
  });

  it("never grants a role it does not name", () => {
    expect(canManageRequirements("owner" as AppRole)).toBe(false);
    expect(canSetProgress("viewer" as AppRole)).toBe(false);
  });

  it("lets the server's exact boolean win and falls back to the role, never to yes", () => {
    expect(resolveFlag(false, true)).toBe(false);
    expect(resolveFlag(true, false)).toBe(true);
    expect(resolveFlag("true", false)).toBe(false);
    expect(resolveFlag(undefined, false)).toBe(false);
    expect(resolveRequirementPermissions(null, "member")).toEqual({ canManage: false, canSetProgress: true });
    expect(
      resolveRequirementPermissions({ permissions: { canManage: false, canSetProgress: null } }, "lead"),
    ).toEqual({ canManage: false, canSetProgress: true });
  });

  it("lets an item be moved only with a row version, a live requirement and both answers yes", () => {
    const item = normalizeRequirementItem(itemWire(), "req-1")!;
    expect(itemProgressEditable(item, true)).toBe(true);
    expect(itemProgressEditable(item, false)).toBe(false);
    expect(itemProgressEditable(item, true, true)).toBe(false);
    expect(itemProgressEditable({ ...item, canSetProgress: false }, true)).toBe(false);
    expect(itemProgressEditable({ ...item, canSetProgress: null }, true)).toBe(true);
    expect(itemProgressEditable({ ...item, rowVersion: null }, true)).toBe(false);
  });
});

describe("reading the wire", () => {
  it("reads a requirement as sent", () => {
    const value = requirement();
    expect(value).toMatchObject({
      id: "req-1",
      kind: "functional",
      deliveryProjectId: "dp-1",
      name: "Checkout with saved cards",
      version: 1,
      progressCounts: { todo: 1, in_progress: 0, done: 1 },
    });
    expect(value.items.map((item) => [item.id, item.requirementId, item.progress, item.rowVersion])).toEqual([
      ["item-1", "req-1", "todo", 1],
      ["item-2", "req-1", "done", 1],
    ]);
  });

  it("degrades missing and malformed fields to safe defaults", () => {
    const value = normalizeRequirement({ id: "r", kind: "epic", items: [{ id: "i", title: "T", progress: "maybe", verificationType: "x", position: 3 }, { title: "no id" }, null] })!;
    expect(value.kind).toBe("system");
    expect(value.name).toBe("Untitled requirement");
    expect(value.version).toBeNull();
    expect(value.items).toHaveLength(1);
    expect(value.items[0]).toMatchObject({ progress: "todo", verificationType: "manual", rowVersion: null, canSetProgress: null, progressBy: null });
    expect(value.progressCounts).toEqual({ todo: 1, in_progress: 0, done: 0 });
    expect(normalizeRequirement({ name: "no id" })).toBeNull();
    expect(normalizeRequirement("x")).toBeNull();
  });

  it("keeps items in position order and reads the actor", () => {
    const value = normalizeRequirement(
      requirementWire({
        items: [
          itemWire({ id: "b", position: 2 }),
          itemWire({ id: "a", position: 1, progressBy: { id: "u", login: "miguel-dev" }, progressAt: "2026-10-01T10:00:00Z" }),
        ],
      }),
    )!;
    expect(value.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(value.items[0].progressBy).toEqual({ id: "u", login: "miguel-dev" });
  });

  it("reads the Project's requirements and leaves missing flags unknown", () => {
    const data = normalizeProjectRequirements(projectRequirementsWire());
    expect(data.deliveryProject).toEqual({ id: "dp-1", name: "storefront", groupId: "ws-1" });
    expect(data.requirements).toHaveLength(2);
    expect(data.permissions).toEqual({ canManage: true, canSetProgress: true });
    expect(normalizeProjectRequirements(null)).toEqual({
      deliveryProject: null,
      requirements: [],
      permissions: { canManage: null, canSetProgress: null },
    });
    expect(normalizeProjectRequirements({ permissions: { canManage: "yes" } }).permissions.canManage).toBeNull();
  });

  it("reads a Progress reply, keeping the caller's item when the reply has none", () => {
    const previous = normalizeRequirementItem(itemWire(), "req-1")!;
    expect(normalizeProgressResult({ item: itemWire({ progress: "done", rowVersion: 2 }), readyForQaNotified: true }, previous)).toEqual({
      item: { ...previous, progress: "done", rowVersion: 2 },
      readyForQaNotified: true,
    });
    expect(normalizeProgressResult({}, previous)).toEqual({ item: previous, readyForQaNotified: false });
  });

  it("counts live requirements per Project from the team overview", () => {
    expect(
      requirementCountsByProject({
        groups: [
          { deliveryProject: { id: "dp-1" }, requirements: [{ id: "a" }, { id: "b", archivedAt: "2026-10-01" }] },
          { deliveryProject: { id: "dp-2" }, requirements: [] },
          { deliveryProject: {}, requirements: [{ id: "x" }] },
        ],
      }),
    ).toEqual({ "dp-1": 1, "dp-2": 0 });
    expect(requirementCountsByProject(null)).toEqual({});
    expect(requirementCountLabel(0)).toBe("No requirements");
    expect(requirementCountLabel(1)).toBe("1 requirement");
    expect(requirementCountLabel(3)).toBe("3 requirements");
  });
});

describe("labels", () => {
  it("names Progress and its tone", () => {
    expect(progressLabel("todo")).toBe("To do");
    expect(progressLabel("in_progress")).toBe("In progress");
    expect(progressLabel("done")).toBe("Done");
    expect(progressTone("done")).toBe("success");
    expect(progressTone("in_progress")).toBe("brand");
    expect(progressTone("todo")).toBe("neutral");
  });

  it("says Features and User stories, System requirements and items", () => {
    expect(kindCopy("functional").section).toBe("Functional Requirements (Features)");
    expect(kindCopy("functional").item).toBe("User story");
    expect(kindCopy("system").section).toBe("System requirements");
    expect(kindCopy("system").item).toBe("Item");
  });

  it("summarises Progress", () => {
    expect(progressSummaryLabel({ todo: 1, in_progress: 1, done: 2 })).toBe("2 of 4 done");
    expect(progressSummaryLabel({ todo: 0, in_progress: 0, done: 0 })).toBe("No items yet");
    expect(donePercent({ todo: 1, in_progress: 0, done: 2 })).toBe(67);
    expect(donePercent({ todo: 0, in_progress: 0, done: 0 })).toBe(0);
    expect(countProgress([{ progress: "done" }, { progress: "todo" }, { progress: "done" }])).toEqual({ todo: 1, in_progress: 0, done: 2 });
  });
});

describe("arranging", () => {
  it("lists live requirements of one kind, oldest first", () => {
    const list = [
      requirement({ id: "late", createdAt: "2026-10-02T00:00:00Z" }),
      requirement({ id: "early", createdAt: "2026-09-01T00:00:00Z" }),
      requirement({ id: "gone", archivedAt: "2026-10-01T00:00:00Z" }),
      normalizeRequirement(systemRequirementWire())!,
    ];
    expect(requirementsOfKind(list, "functional").map((entry) => entry.id)).toEqual(["early", "late"]);
    expect(requirementsOfKind(list, "system").map((entry) => entry.id)).toEqual(["req-sys"]);
  });

  it("upserts requirements and items, recounting Progress", () => {
    const base = [requirement()];
    expect(upsertRequirement(base, requirement({ name: "Renamed" }))[0].name).toBe("Renamed");
    expect(upsertRequirement(base, requirement({ id: "new" }))).toHaveLength(2);

    const item = { ...base[0].items[0], progress: "done" as const };
    const replaced = upsertRequirementItem(base, "req-1", item);
    expect(replaced[0].progressCounts).toEqual({ todo: 0, in_progress: 0, done: 2 });
    const appended = upsertRequirementItem(base, "req-1", { ...item, id: "item-3", position: 5 });
    expect(appended[0].items.map((entry) => entry.id)).toEqual(["item-1", "item-2", "item-3"]);
    expect(upsertRequirementItem(base, "other", item)).toEqual(base);

    const removed = removeRequirementItem(base, "req-1", "item-2");
    expect(removed[0].items.map((entry) => entry.id)).toEqual(["item-1"]);
    expect(removed[0].progressCounts).toEqual({ todo: 1, in_progress: 0, done: 0 });
    expect(removeRequirementItem(base, "other", "item-2")).toEqual(base);
  });

  it("reorders by swapping neighbours and refuses moves past the ends", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(reorderedItemIds(items, "b", -1)).toEqual(["b", "a", "c"]);
    expect(reorderedItemIds(items, "b", 1)).toEqual(["a", "c", "b"]);
    expect(reorderedItemIds(items, "a", -1)).toBeNull();
    expect(reorderedItemIds(items, "c", 1)).toBeNull();
    expect(reorderedItemIds(items, "zzz", 1)).toBeNull();
    const reordered = withItemOrder(requirement(), ["item-2", "item-1"]);
    expect(reordered.items.map((item) => [item.id, item.position])).toEqual([
      ["item-2", 0],
      ["item-1", 1],
    ]);
  });
});

describe("requirement drafts", () => {
  it("validates the name and each story row", () => {
    expect(requirementDraftError(blankRequirementDraft(), "functional")).toBe("Give the Feature a name.");
    expect(requirementDraftError({ ...blankRequirementDraft(), name: "x".repeat(201) }, "system")).toMatch(/under 200/);
    expect(requirementDraftError({ name: "Pay", description: "", stories: ["x".repeat(301)] }, "functional")).toBe(
      "Keep each user story under 300 characters.",
    );
    expect(requirementDraftError({ name: "Sec", description: "", stories: ["x".repeat(301)] }, "system")).toBe(
      "Keep each item under 300 characters.",
    );
    expect(requirementDraftError({ name: "Pay", description: "", stories: ["One", "", "Two"] }, "functional")).toBeNull();
  });

  it("starts with one blank row to type into", () => {
    expect(blankRequirementDraft().stories).toEqual([""]);
  });

  it("turns rows into stories and builds the create body", () => {
    expect(storiesFromRows([" One ", "", "  ", " Two "])).toEqual([{ title: "One" }, { title: "Two" }]);
    expect(createRequirementPayload("functional", { name: " Pay ", description: " ", stories: [""] })).toEqual({
      kind: "functional",
      name: "Pay",
    });
    expect(createRequirementPayload("system", { name: "Sec", description: " Why ", stories: ["A", "B"] })).toEqual({
      kind: "system",
      name: "Sec",
      description: "Why",
      items: [{ title: "A" }, { title: "B" }],
    });
  });

  it("patches only what changed, with the version read", () => {
    const value = requirement();
    const draft = requirementDraftFrom(value);
    expect(updateRequirementPayload(value, draft)).toBeNull();
    expect(updateRequirementPayload(value, { ...draft, name: "Saved cards" })).toEqual({ expectedVersion: 1, name: "Saved cards" });
    expect(updateRequirementPayload(value, { ...draft, description: "  " })).toEqual({ expectedVersion: 1, description: null });
    expect(updateRequirementPayload({ ...value, version: null }, { ...draft, name: "x" })).toBeNull();
  });
});

describe("item drafts", () => {
  const item = normalizeRequirementItem(itemWire(), "req-1")!;

  it("validates title and acceptance criteria", () => {
    expect(requirementItemDraftError(blankItemDraft(), "User story")).toBe("Give the user story a title.");
    expect(requirementItemDraftError({ ...blankItemDraft(), title: "x".repeat(301) }, "Item")).toMatch(/under 300/);
    expect(requirementItemDraftError({ ...blankItemDraft(), title: "ok", acceptanceCriteria: "x".repeat(4001) }, "Item")).toMatch(/4000/);
    expect(requirementItemDraftError({ ...blankItemDraft(), title: "ok" }, "Item")).toBeNull();
  });

  it("never sends a test identifier for a manual check", () => {
    expect(createItemPayload({ title: " T ", acceptanceCriteria: "", verificationType: "manual", testIdentifier: "x" })).toEqual({
      title: "T",
      acceptanceCriteria: null,
      verificationType: "manual",
      testIdentifier: null,
    });
    expect(createItemPayload({ title: "T", acceptanceCriteria: "AC", verificationType: "playwright", testIdentifier: " e2e/a.spec.ts " }).testIdentifier).toBe(
      "e2e/a.spec.ts",
    );
  });

  it("patches an item by id with its row version, only what changed", () => {
    const draft = itemDraftFromRequirementItem(item);
    expect(updateItemPayload(item, draft)).toBeNull();
    expect(updateItemPayload(item, { ...draft, title: "New title", acceptanceCriteria: "" })).toEqual({
      expectedRowVersion: 1,
      title: "New title",
      acceptanceCriteria: null,
    });
    expect(updateItemPayload(item, { ...draft, verificationType: "unit_test", testIdentifier: "src/a.test.ts" })).toEqual({
      expectedRowVersion: 1,
      verificationType: "unit_test",
      testIdentifier: "src/a.test.ts",
    });
    expect(updateItemPayload({ ...item, rowVersion: null }, { ...draft, title: "x" })).toBeNull();
  });
});

describe("requirementError", () => {
  it("says the coded refusals in product words and flags the ones a reload fixes", () => {
    expect(requirementError(apiErrorWith(409, { code: "REQUIREMENT_ITEM_STALE" }), "x")).toEqual({
      message: expect.stringContaining("Someone else changed this item"),
      stale: true,
    });
    expect(requirementError(apiErrorWith(409, { code: "REQUIREMENT_NAME_TAKEN" }), "x")).toEqual({
      message: "This Project already has a requirement with that name. Pick another name.",
      stale: false,
    });
    expect(requirementError(apiErrorWith(403, { code: "PROGRESS_FORBIDDEN" }), "x").message).toMatch(/QA Team records Verification/);
  });

  it("falls back by status, never to the server's raw object", () => {
    expect(requirementError(apiErrorWith(403), "fallback").message).toBe("Your role cannot make this change.");
    expect(requirementError(apiErrorWith(404), "fallback").message).toMatch(/no longer exists/);
    expect(requirementError(apiErrorWith(500, { message: "boom" }), "fallback").message).toBe("fallback");
    expect(requirementError(new Error("network"), "fallback")).toEqual({ message: "fallback", stale: false });
  });
});

describe("story rows", () => {
  it("edits one row", () => {
    expect(editStoryRow(["a", "b"], 1, "B")).toEqual(["a", "B"]);
  });

  it("adds a blank row after a row, or at the end", () => {
    expect(addStoryRow(["a", "b"], 0)).toEqual(["a", "", "b"]);
    expect(addStoryRow(["a", "b"])).toEqual(["a", "b", ""]);
  });

  it("removes a row but never the last one", () => {
    expect(removeStoryRow(["a", "b", "c"], 1)).toEqual(["a", "c"]);
    expect(removeStoryRow(["only"], 0)).toEqual([""]);
  });

  it("splits a multi-line paste into rows", () => {
    // Into a blank row: the pasted lines take its place.
    expect(pasteIntoStoryRows(["a", "", "c"], 1, "One\r\n\n Two \n")).toEqual(["a", "One", "Two", "c"]);
    // Into a filled row: they land right after it.
    expect(pasteIntoStoryRows(["a", "c"], 0, "One\nTwo")).toEqual(["a", "One", "Two", "c"]);
  });

  it("leaves a single-line paste to the input", () => {
    expect(pasteIntoStoryRows([""], 0, "Just one")).toBeNull();
    expect(pasteIntoStoryRows([""], 0, "Just one\n\n")).toBeNull();
  });
});
