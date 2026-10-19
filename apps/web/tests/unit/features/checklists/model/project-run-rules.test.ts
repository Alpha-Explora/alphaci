import {
  allowedVerificationStatuses,
  applyItemToMyItems,
  bucketCopy,
  canPass,
  canStartProjectRun,
  canVerifyItem,
  feedItemKey,
  groupOffsets,
  groupPassLabel,
  groupRunItems,
  headChangeMessage,
  headChangeMessages,
  headLabel,
  initialExpandedGroups,
  itemMatchesRunFilter,
  isVerificationStatus,
  normalizeHeadStatus,
  normalizeProjectMyItems,
  normalizeProjectRun,
  normalizeProjectRunCurrent,
  passedUnavailableReason,
  projectMyItemsCount,
  replaceRunItem,
  repoShortName,
  repositoriesLabel,
  requirementsChangedLabel,
  requirementsChangedNote,
  resolveProjectRunPermissions,
  runFilterCounts,
  runFilterEmptyText,
  runFilterLabel,
  runFromReply,
  summarizeRunItems,
  verificationPayload,
  visibleRunFilters,
} from "../../../../../src/features/checklists/model/project-run-rules";
import type { ProjectQaRun } from "../../../../../src/features/checklists/model/project-run-types";
import { itemDraftFrom } from "../../../../../src/features/checklists/model/qa-run-rules";
import { normalizeRequirementItem } from "../../../../../src/features/checklists/model/requirement-rules";
import { headWire, itemWire, projectRunWire, runItemWire, SHA_BE, SHA_BE_NEW, SHA_FE } from "../requirement-fixtures";

function run(overrides: Record<string, unknown> = {}): ProjectQaRun {
  return normalizeProjectRun(projectRunWire(overrides))!;
}

const OPEN = { status: "open" as const };
const CAN = { canSetVerification: true };

describe("reading the wire", () => {
  it("reads a Project run as sent", () => {
    const value = run();
    expect(value).toMatchObject({
      id: "prun-1",
      deliveryProjectId: "dp-1",
      deliveryProjectName: "storefront",
      status: "open",
      stale: false,
      requirementsChanged: false,
      createdBy: { id: "user-qa", login: "ana-qa" },
      permissions: { canSetVerification: true, canSignOff: true, canReopen: false, canDispatch: true },
    });
    expect(value.repositories).toHaveLength(2);
    expect(value.items.map((item) => [item.id, item.requirementKind, item.progress])).toEqual([
      ["run-item-1", "functional", "done"],
      ["run-item-2", "system", "todo"],
    ]);
    expect(value.summary.total).toBe(2);
    expect(value.summary.byStatus.pending).toBe(2);
  });

  it("degrades a broken run: no id is no run, unknown values become safe defaults", () => {
    expect(normalizeProjectRun({ items: [] })).toBeNull();
    const value = normalizeProjectRun({ id: "r", status: "weird", items: [{ id: "i", title: "T", status: "passed", requirementKind: "epic", progress: "?" }, { id: "x" }], permissions: { canSetVerification: "yes" } })!;
    expect(value.status).toBe("open");
    expect(value.deliveryProjectName).toBe("Project");
    expect(value.items).toHaveLength(1);
    expect(value.items[0]).toMatchObject({ requirementKind: "system", requirementName: "Requirement", progress: null, rowVersion: null });
    expect(value.permissions.canSetVerification).toBeNull();
    expect(value.signoff).toBeNull();
  });

  it("reads a sign-off only when it is complete", () => {
    const signed = run({
      status: "signed_off",
      signoff: { id: "s1", verdict: "APPROVED", summary: "Good", conditions: null, signedBy: { id: "u", login: "ana-qa" }, signedAt: "2026-10-01T10:00:00Z" },
    });
    expect(signed.signoff).toMatchObject({ verdict: "APPROVED", summary: "Good" });
    expect(run({ signoff: { id: "s1", verdict: "MAYBE" } }).signoff).toBeNull();
  });

  it("reads heads, deriving moved from differing commits", () => {
    expect(normalizeHeadStatus(headWire())).toMatchObject({ moved: false });
    expect(normalizeHeadStatus(headWire({ currentSha: SHA_BE_NEW }))?.moved).toBe(true);
    expect(normalizeHeadStatus(headWire({ moved: true }))?.moved).toBe(true);
    expect(normalizeHeadStatus(headWire({ runSha: null }))?.moved).toBe(false);
    expect(normalizeHeadStatus({ repoFullName: "x" })).toBeNull();
  });

  it("marks a run stale when a repository moved or joined, even without the flag", () => {
    expect(run({ repositories: [headWire({ currentSha: SHA_BE_NEW })] }).stale).toBe(true);
    // A repository that joined since: no captured head, and the server says moved.
    expect(run({ repositories: [headWire({ runSha: null, moved: true })] }).stale).toBe(true);
    expect(run({ repositories: [headWire({ runSha: null })] }).stale).toBe(false);
    expect(run({ stale: true, repositories: [] }).stale).toBe(true);
  });

  it("reads the current-heads answer, falling back to the run's heads", () => {
    const current = normalizeProjectRunCurrent({ run: projectRunWire(), heads: [headWire()], stale: false });
    expect(current.run?.id).toBe("prun-1");
    expect(current.heads).toHaveLength(1);
    expect(normalizeProjectRunCurrent({ run: projectRunWire({ requirementsChanged: true }) })).toMatchObject({
      heads: expect.arrayContaining([expect.objectContaining({ projectId: "proj-be" })]),
      requirementsChanged: true,
    });
    expect(normalizeProjectRunCurrent(undefined)).toEqual({ run: null, heads: [], stale: false, requirementsChanged: false });
  });

  it("finds a run in a write's reply, bare or wrapped", () => {
    expect(runFromReply(projectRunWire())?.id).toBe("prun-1");
    expect(runFromReply({ run: projectRunWire() })?.id).toBe("prun-1");
    expect(runFromReply({ item: runItemWire() })).toBeNull();
    expect(runFromReply(null)).toBeNull();
  });

  it("tallies defects and blockers from the items", () => {
    const summary = summarizeRunItems([
      { status: "failed", defectSeverity: "blocker" },
      { status: "returned_to_dev", defectSeverity: "minor" },
      { status: "passed", defectSeverity: null },
    ]);
    expect(summary).toMatchObject({ total: 3, openDefects: 2, blockers: 1 });
    expect(summary.byStatus.passed).toBe(1);
  });
});

describe("who may record Verification", () => {
  it("lets the run's flags win and the role stand in only when one is missing", () => {
    expect(resolveProjectRunPermissions(run(), "member")).toEqual({
      canSetVerification: true,
      canSignOff: true,
      canReopen: false,
      canDispatch: true,
      canManageTestCases: false,
    });
    const unflagged = {
      permissions: {
        canSetVerification: null,
        canSignOff: null,
        canReopen: null,
        canDispatch: null,
        canManageTestCases: null,
      },
    };
    expect(resolveProjectRunPermissions(unflagged, "member")).toEqual({
      canSetVerification: false,
      canSignOff: false,
      canReopen: false,
      canDispatch: false,
      canManageTestCases: false,
    });
    expect(resolveProjectRunPermissions(unflagged, "lead")).toEqual({
      canSetVerification: true,
      canSignOff: true,
      canReopen: true,
      canDispatch: true,
      canManageTestCases: false,
    });
    // The QA Team writes test cases; a Product owner verifies but does not.
    expect(resolveProjectRunPermissions(unflagged, "qa").canManageTestCases).toBe(true);
    expect(resolveProjectRunPermissions(null, "qa").canReopen).toBe(false);
  });

  it("starts runs for QA Team, Product owners and admins only", () => {
    expect(["qa", "lead", "admin"].every((role) => canStartProjectRun(role as never))).toBe(true);
    expect(canStartProjectRun("member")).toBe(false);
    expect(canStartProjectRun(undefined)).toBe(false);
  });

  it("offers Passed only once a Developer marked the item Done, and never In progress", () => {
    const done = run().items[0];
    const todo = run().items[1];
    expect(allowedVerificationStatuses(done, OPEN, CAN)).toEqual(["pending", "passed", "failed", "blocked", "returned_to_dev"]);
    expect(allowedVerificationStatuses(todo, OPEN, CAN)).toEqual(["pending", "failed", "blocked", "returned_to_dev"]);
    expect(allowedVerificationStatuses({ ...done, progress: null }, OPEN, CAN)).not.toContain("passed");
    expect(canPass(done)).toBe(true);
    expect(passedUnavailableReason(done)).toBeNull();
    expect(passedUnavailableReason(todo)).toBe("A Developer marks this Done before QA can pass it.");
  });

  it("offers nothing on a signed-off run, without the permission, or without a row version", () => {
    const item = run().items[0];
    expect(allowedVerificationStatuses(item, { status: "signed_off" }, CAN)).toEqual([]);
    expect(allowedVerificationStatuses(item, OPEN, { canSetVerification: false })).toEqual([]);
    expect(canVerifyItem({ rowVersion: null }, OPEN, CAN)).toBe(false);
    expect(isVerificationStatus("in_progress")).toBe(false);
    expect(isVerificationStatus("blocked")).toBe(true);
  });

  it("always sends the status, plus only the fields that changed", () => {
    const item = run().items[0];
    expect(verificationPayload(item, itemDraftFrom(item))).toBeNull();
    expect(verificationPayload(item, itemDraftFrom(item, "passed"))).toEqual({ status: "passed", expectedRowVersion: 1 });
    expect(
      verificationPayload(item, { status: "returned_to_dev", notes: " Broken ", defectSeverity: "major", reproductionSteps: "1. Pay" }),
    ).toEqual({
      status: "returned_to_dev",
      expectedRowVersion: 1,
      notes: "Broken",
      defectSeverity: "major",
      reproductionSteps: "1. Pay",
    });
    expect(verificationPayload(item, { ...itemDraftFrom(item), notes: "seen" })).toEqual({
      status: "pending",
      expectedRowVersion: 1,
      notes: "seen",
    });
    expect(verificationPayload(item, itemDraftFrom(item, "in_progress"))).toBeNull();
    expect(verificationPayload({ ...item, rowVersion: null }, itemDraftFrom(item, "passed"))).toBeNull();
  });
});

describe("what the run panel says", () => {
  it("names repositories and heads", () => {
    expect(repoShortName("tone/orders-api")).toBe("orders-api");
    expect(repoShortName("solo")).toBe("solo");
    expect(headLabel("tone/orders-api", SHA_BE)).toBe("orders-api @ e4f5a6b");
    expect(headLabel("tone/orders-api", null)).toBe("orders-api");
    expect(repositoriesLabel(1)).toBe("1 repository");
    expect(repositoriesLabel(2)).toBe("2 repositories");
  });

  it("says which repository moved, joined or could not be read", () => {
    const heads = [
      normalizeHeadStatus(headWire())!,
      normalizeHeadStatus(headWire({ projectId: "b", repoFullName: "tone/orders-api", runSha: SHA_BE, currentSha: SHA_BE_NEW }))!,
      normalizeHeadStatus(headWire({ projectId: "c", repoFullName: "tone/new-svc", runSha: null, moved: true }))!,
      normalizeHeadStatus(headWire({ projectId: "d", repoFullName: "tone/broken", currentSha: null }))!,
    ];
    expect(headChangeMessage(heads[0])).toBeNull();
    expect(headChangeMessages(heads)).toEqual([
      "orders-api moved since this run (e4f5a6b → ffffeee)",
      "new-svc joined the Project since this run",
      "Could not read the uat head of broken",
    ]);
    expect(SHA_FE).toHaveLength(40);
  });

  it("words requirement changes by run state", () => {
    expect(requirementsChangedLabel({ status: "signed_off" })).toBe("Requirements changed since sign-off");
    expect(requirementsChangedLabel({ status: "open" })).toBe("Requirements changed since this run started");
    // Blocking now: a signed-off run must be reopened; an open run takes the new items.
    expect(requirementsChangedNote({ status: "signed_off" })).toBe(
      "Merge to main stays blocked until QA verifies the change. A Product owner reopens the run: new items join it as Pending, and QA signs off again.",
    );
    expect(requirementsChangedNote({ status: "open" })).toBe(
      "New items join this run as Pending. Merge to main needs every item passed.",
    );
  });

  it("groups items by requirement, Features first, in run order", () => {
    const value = run({
      items: [
        runItemWire({ id: "s1", position: 0, requirementId: "sys", requirementName: "Smoke", requirementKind: "system" }),
        runItemWire({ id: "f2", position: 2, requirementId: "feat", requirementName: "Pay" }),
        runItemWire({ id: "f1", position: 1, requirementId: "feat", requirementName: "Pay" }),
        runItemWire({ id: "o1", position: 3, requirementId: null, requirementName: "Deleted", requirementKind: "functional" }),
      ],
    });
    expect(groupRunItems(value.items).map((group) => [group.key, group.kind, group.items.map((item) => item.id)])).toEqual([
      ["feat", "functional", ["f1", "f2"]],
      ["functional:Deleted", "functional", ["o1"]],
      ["sys", "system", ["s1"]],
    ]);
  });

  it("replaces one item and recounts", () => {
    const value = run();
    const next = replaceRunItem(value, { ...value.items[0], status: "passed" });
    expect(next.summary.byStatus.passed).toBe(1);
    expect(next.items[1]).toBe(value.items[1]);
  });
});

describe("My QA items (project-wide)", () => {
  const feed = {
    requirement: { id: "req-1", name: "Checkout", kind: "functional" },
    item: itemWire({ progress: "in_progress" }),
    runId: "prun-1",
    runItem: runItemWire({ status: "returned_to_dev", defectSeverity: "major", notes: "Broken" }),
  };

  it("reads the four buckets and drops broken rows", () => {
    const data = normalizeProjectMyItems({
      returned: [feed, { requirement: {}, item: itemWire() }, { requirement: { id: "r" } }],
      inProgress: [{ ...feed, runId: null, runItem: null }],
      todo: "nope",
    });
    expect(data.returned).toHaveLength(1);
    expect(data.returned[0].runItem).toMatchObject({ status: "returned_to_dev", notes: "Broken" });
    expect(data.returned[0].item.requirementId).toBe("req-1");
    expect(data.inProgress[0].runItem).toBeNull();
    expect(data.todo).toEqual([]);
    expect(data.readyForQa).toEqual([]);
    expect(projectMyItemsCount(data)).toBe(2);
    expect(feedItemKey(data.returned[0])).toBe("req-1:item-1");
    expect(normalizeProjectMyItems(null)).toEqual({ returned: [], inProgress: [], todo: [], readyForQa: [] });
  });

  it("folds a saved item into whichever bucket holds it", () => {
    const data = normalizeProjectMyItems({ returned: [feed], todo: [{ ...feed, item: itemWire({ id: "other" }) }] });
    const saved = normalizeRequirementItem(itemWire({ progress: "done", rowVersion: 2 }), "req-1")!;
    const next = applyItemToMyItems(data, saved);
    expect(next.returned[0].item.progress).toBe("done");
    expect(next.todo[0].item.id).toBe("other");
  });

  it("titles every bucket", () => {
    expect(bucketCopy("returned").title).toBe("Returned by QA");
    expect(bucketCopy("inProgress").title).toBe("In progress");
    expect(bucketCopy("todo").title).toBe("To do");
    expect(bucketCopy("readyForQa").title).toBe("Ready for QA");
  });
});

describe("as implemented by the backend (3147e15)", () => {
  it("reads sourceItemId and the per-item canUpdate, and honours a per-item no", () => {
    const value = run({ items: [runItemWire({ sourceItemId: "item-1", canUpdate: false })] });
    expect(value.items[0]).toMatchObject({ sourceItemId: "item-1", canUpdate: false });
    expect(allowedVerificationStatuses(value.items[0], OPEN, CAN)).toEqual([]);
    expect(run().items[0]).toMatchObject({ sourceItemId: null, canUpdate: null });
  });

  it("says nothing about a head no run is compared against", () => {
    const head = normalizeHeadStatus(headWire({ runSha: null, moved: false }))!;
    expect(headChangeMessage(head)).toBeNull();
    expect(headChangeMessage({ ...head, moved: true })).toBe("storefront-web joined the Project since this run");
  });
});

describe("the run list: filters and groups", () => {
  const items = [
    { status: "passed" as const },
    { status: "pending" as const },
    { status: "pending" as const },
    { status: "returned_to_dev" as const },
    { status: "in_progress" as const },
  ];

  it("counts every Verification, a stray in_progress as still to verify", () => {
    expect(runFilterCounts(items)).toEqual({ all: 5, pending: 3, failed: 0, returned_to_dev: 1, blocked: 0, passed: 1 });
    expect(itemMatchesRunFilter({ status: "in_progress" }, "pending")).toBe(true);
    expect(itemMatchesRunFilter({ status: "failed" }, "pending")).toBe(false);
    expect(itemMatchesRunFilter({ status: "failed" }, "all")).toBe(true);
  });

  it("offers All, the non-empty filters, and the chosen one even once it empties", () => {
    const counts = runFilterCounts(items);
    expect(visibleRunFilters(counts, "all")).toEqual(["all", "pending", "returned_to_dev", "passed"]);
    expect(visibleRunFilters(counts, "blocked")).toEqual(["all", "pending", "returned_to_dev", "blocked", "passed"]);
    expect(runFilterLabel("pending")).toBe("To verify");
    expect(runFilterLabel("returned_to_dev")).toBe("Returned");
    expect(runFilterEmptyText("pending")).toBe("Nothing left to verify.");
  });

  it("numbers groups across the run and says how far each got", () => {
    const groups = groupRunItems(run({ items: [runItemWire({ status: "passed" }), runItemWire({ id: "b", position: 1, requirementId: "req-2", requirementName: "Two" }), runItemWire({ id: "c", position: 2, requirementId: "req-2", requirementName: "Two" })] }).items);
    expect(groupOffsets(groups)).toEqual([0, 1]);
    expect(groups.map(groupPassLabel)).toEqual(["1 of 1 passed", "0 of 2 passed"]);
  });

  it("folds a requirement only when every item passed", () => {
    const groups = groupRunItems(run({ items: [runItemWire({ status: "passed" }), runItemWire({ id: "b", position: 1, requirementId: "req-2", requirementName: "Two", status: "failed" })] }).items);
    expect(initialExpandedGroups(groups)).toEqual({ "req-1": false, "req-2": true });
  });
});
