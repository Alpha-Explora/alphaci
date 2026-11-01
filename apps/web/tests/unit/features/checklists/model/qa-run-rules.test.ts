import {
  agoLabel,
  allowedItemStatuses,
  canEditItem,
  canRequestRetest,
  commitLabel,
  commitSourceLabel,
  defaultVerdict,
  itemDraftError,
  itemDraftFrom,
  itemStatusLabel,
  itemStatusTone,
  itemUpdatePayload,
  isStaleRunConflict,
  previousResultLabel,
  qaActionError,
  roleCanRequestRetest,
  roleCanStartRun,
  severityLabel,
  signoffBlockedReason,
  signoffEligibility,
  signoffError,
  signoffPayload,
  statusSegments,
  STALE_RUN_MESSAGE,
  verdictLabel,
} from "../../../../../src/features/checklists/model/qa-run-rules";
import { apiError } from "../checklist-fixtures";
import { qaRun, runAs, runItem } from "../qa-run-fixtures";

describe("labels", () => {
  it("names every status, severity and verdict as the product does", () => {
    expect(
      (["pending", "in_progress", "passed", "failed", "blocked", "returned_to_dev"] as const).map(
        itemStatusLabel,
      ),
    ).toEqual(["Pending", "In progress", "Passed", "Failed", "Blocked", "Returned to dev"]);
    expect((["blocker", "major", "minor"] as const).map(severityLabel)).toEqual([
      "Blocker",
      "Major",
      "Minor",
    ]);
    expect((["APPROVED", "REJECTED", "CONDITIONAL"] as const).map(verdictLabel)).toEqual([
      "Approved",
      "Rejected",
      "Conditional",
    ]);
  });

  it("maps statuses onto the semantic tones", () => {
    expect(itemStatusTone("passed")).toBe("success");
    expect(itemStatusTone("failed")).toBe("danger");
    expect(itemStatusTone("blocked")).toBe("danger");
    expect(itemStatusTone("returned_to_dev")).toBe("warning");
    expect(itemStatusTone("in_progress")).toBe("brand");
    expect(itemStatusTone("pending")).toBe("neutral");
  });

  it("formats the commit, its source, relative times and the previous result", () => {
    expect(commitLabel("main", "abc1234def")).toBe("main @ abc1234");
    expect(commitLabel("main", null)).toBe("main");
    expect(commitSourceLabel("deployment")).toBe("deployed");
    expect(commitSourceLabel("branch_head")).toBe("not deployed — testing the branch head");
    expect(commitSourceLabel(null)).toBeNull();
    const now = Date.parse("2026-09-25T12:00:00.000Z");
    expect(agoLabel("2026-09-25T11:59:40.000Z", now)).toBe("just now");
    expect(agoLabel("2026-09-25T11:48:00.000Z", now)).toBe("12m ago");
    expect(agoLabel("2026-09-25T07:00:00.000Z", now)).toBe("5h ago");
    expect(agoLabel("2026-09-22T12:00:00.000Z", now)).toBe("3d ago");
    expect(agoLabel(null, now)).toBe("");
    expect(previousResultLabel(runItem(0))).toBeNull();
    expect(
      previousResultLabel(
        runItem(0, { previous: { runId: "r0", commitSha: "abc1234ffff", status: "failed" } }),
      ),
    ).toBe("Last run on abc1234: Failed");
  });
});

describe("who may do what — mirrors the server", () => {
  const qaItem = runItem(0, { targetPersona: "qa" });
  const devItem = runItem(1, { targetPersona: "developer" });
  const allItem = runItem(2, { targetPersona: "all" });

  function statusesAs(role: "qa" | "member" | "lead" | "admin", item = qaItem) {
    const run = runAs(role, { items: [qaItem, devItem, allItem] });
    const seen = run.items.find((candidate) => candidate.id === item.id)!;
    return allowedItemStatuses(seen, run);
  }

  it("lets QA Team change qa items and everyone's items, never developer items", () => {
    expect(statusesAs("qa", qaItem)).toContain("returned_to_dev");
    expect(statusesAs("qa", allItem)).toHaveLength(6);
    expect(statusesAs("qa", devItem)).toEqual([]);
  });

  it("lets a Developer change developer items but never return anything to dev", () => {
    expect(statusesAs("member", devItem)).toEqual([
      "pending",
      "in_progress",
      "passed",
      "failed",
      "blocked",
    ]);
    expect(statusesAs("member", qaItem)).toEqual([]);
  });

  it("lets Team leads and Admins change every item", () => {
    for (const role of ["lead", "admin"] as const) {
      for (const item of [qaItem, devItem, allItem]) {
        expect(statusesAs(role, item)).toHaveLength(6);
      }
    }
  });

  it("never allows more than the server: canUpdate false, no item rights, or signed off", () => {
    const run = qaRun();
    expect(allowedItemStatuses({ canUpdate: false }, run)).toEqual([]);
    expect(
      allowedItemStatuses({ canUpdate: true }, { ...run, permissions: { ...run.permissions, canUpdateItems: false } }),
    ).toEqual([]);
    expect(canEditItem({ canUpdate: true }, { ...run, status: "signed_off" })).toBe(false);
  });

  it("offers re-test only on returned items, with the permission, on an open run", () => {
    const run = runAs("member");
    const returned = runItem(0, { status: "returned_to_dev" });
    expect(canRequestRetest(returned, run)).toBe(true);
    expect(canRequestRetest(runItem(0, { status: "failed" }), run)).toBe(false);
    expect(canRequestRetest(returned, runAs("qa"))).toBe(false);
    expect(canRequestRetest(returned, { ...run, status: "signed_off" })).toBe(false);
  });

  it("derives start and re-test rights from the role where no run permissions exist", () => {
    expect(["qa", "lead", "admin", "member"].map((role) => roleCanStartRun(role as never))).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(roleCanStartRun(undefined)).toBe(false);
    expect(["qa", "lead", "admin", "member"].map((role) => roleCanRequestRetest(role as never))).toEqual([
      false,
      true,
      true,
      true,
    ]);
  });
});

describe("item drafts", () => {
  it("requires a severity for Failed and Returned to dev, not for the rest", () => {
    const item = runItem(0);
    expect(itemDraftError(itemDraftFrom(item, "failed"))).toBe(
      "Choose a severity before marking this item Failed.",
    );
    expect(itemDraftError(itemDraftFrom(item, "returned_to_dev"))).toMatch(/Returned to dev/);
    expect(itemDraftError({ ...itemDraftFrom(item, "failed"), defectSeverity: "minor" })).toBeNull();
    expect(itemDraftError(itemDraftFrom(item, "blocked"))).toBeNull();
    expect(itemDraftError(itemDraftFrom(item, "passed"))).toBeNull();
  });

  it("sends the rowVersion read plus only what changed, trimmed", () => {
    const item = runItem(0, { rowVersion: 7, notes: "old" });
    expect(itemUpdatePayload(item, itemDraftFrom(item))).toBeNull();
    expect(
      itemUpdatePayload(item, {
        status: "failed",
        notes: "  broke  ",
        defectSeverity: "major",
        reproductionSteps: " 1. open ",
      }),
    ).toEqual({
      expectedRowVersion: 7,
      status: "failed",
      notes: "broke",
      defectSeverity: "major",
      reproductionSteps: "1. open",
    });
    expect(itemUpdatePayload(item, { ...itemDraftFrom(item), notes: "" })).toEqual({
      expectedRowVersion: 7,
      notes: null,
    });
  });
});

describe("summary", () => {
  it("drops empty statuses and sizes each share of the run", () => {
    const run = qaRun({
      items: [
        runItem(0, { status: "passed" }),
        runItem(1, { status: "passed" }),
        runItem(2, { status: "failed" }),
        runItem(3),
      ],
    });
    expect(statusSegments(run)).toEqual([
      { status: "pending", count: 1, percent: 25 },
      { status: "passed", count: 2, percent: 50 },
      { status: "failed", count: 1, percent: 25 },
    ]);
    expect(statusSegments(qaRun({ items: [] }))).toEqual([]);
  });
});

describe("signoff eligibility", () => {
  it("allows Approved only when every item passed", () => {
    const allPassed = qaRun({ items: [runItem(0, { status: "passed" }), runItem(1, { status: "passed" })] });
    expect(signoffEligibility(allPassed).map((entry) => entry.allowed)).toEqual([true, true, true]);
    expect(defaultVerdict(allPassed)).toBe("APPROVED");

    const twoOpen = qaRun({ items: [runItem(0, { status: "in_progress" }), runItem(1)] });
    const approved = signoffEligibility(twoOpen)[0];
    expect(approved).toEqual({ verdict: "APPROVED", allowed: false, reason: "2 items are not passed yet." });
  });

  it("allows Conditional once nothing is pending or in progress, with conditions written", () => {
    const pending = qaRun({ items: [runItem(0, { status: "in_progress" }), runItem(1, { status: "passed" })] });
    expect(signoffEligibility(pending)[1]).toEqual({
      verdict: "CONDITIONAL",
      allowed: false,
      reason: "1 item is still pending or in progress.",
    });
    const settled = qaRun({ items: [runItem(0, { status: "passed" }), runItem(1, { status: "passed" })] });
    expect(signoffEligibility(settled)[1]?.allowed).toBe(true);
    expect(signoffError(settled, "CONDITIONAL", "  ")).toBe(
      "Write the conditions this approval depends on.",
    );
    expect(signoffError(settled, "CONDITIONAL", "Fix copy next release")).toBeNull();
  });

  it("offers no verdict while QA has a failure open, and says why", () => {
    const open = qaRun({
      items: [runItem(0, { status: "passed" }), runItem(1, { status: "blocked" }), runItem(2, { status: "failed" })],
    });
    const reason = "2 items are failed, blocked or returned to dev. Sign off once QA has verified the fixes.";
    expect(signoffBlockedReason(open)).toBe(reason);
    expect(signoffEligibility(open)).toEqual([
      { verdict: "APPROVED", allowed: false, reason },
      { verdict: "CONDITIONAL", allowed: false, reason },
      { verdict: "REJECTED", allowed: false, reason },
    ]);
    expect(signoffBlockedReason(qaRun({ items: [runItem(0, { status: "returned_to_dev" })] }))).toBe(
      "1 item is failed, blocked or returned to dev. Sign off once QA has verified the fix.",
    );
    expect(signoffBlockedReason(qaRun({ items: [runItem(0), runItem(1, { status: "passed" })] }))).toBeNull();
  });

  it("always allows Rejected, and refuses approving an empty run", () => {
    expect(signoffEligibility(qaRun({ items: [runItem(0)] }))[2].allowed).toBe(true);
    expect(signoffError(qaRun({ items: [] }), "APPROVED", "")).toBe("This run has no items to approve.");
    expect(defaultVerdict(qaRun({ items: [runItem(0)] }))).toBe("REJECTED");
  });

  it("builds the body with trimmed text and conditions only for Conditional", () => {
    expect(signoffPayload("APPROVED", "  ok  ", "ignored")).toEqual({ verdict: "APPROVED", summary: "ok" });
    expect(signoffPayload("CONDITIONAL", "", " fix it ")).toEqual({ verdict: "CONDITIONAL", conditions: "fix it" });
    expect(signoffPayload("REJECTED", " ", "")).toEqual({ verdict: "REJECTED" });
  });
});

describe("errors", () => {
  // The exact 409 bodies the backend sends ({ code, message }); keyed on code.
  it.each([
    ["QA_ITEM_STALE", "This item has changed (expected row version 3); reload and try again."],
    ["QA_RUN_CHANGED", "This run changed while you were signing off. Review the latest results and sign off again."],
  ])("offers a reload for the backend's %s conflict", (code, message) => {
    const cause = Object.assign(new Error("Request failed with status 409"), {
      status: 409,
      details: { code, message },
    });
    expect(isStaleRunConflict(cause)).toBe(true);
    expect(qaActionError(cause, "x")).toEqual({ message, stale: true });
  });

  it("does not offer a reload for the signed-off 409, which a reload cannot fix", () => {
    const cause = Object.assign(new Error("x"), {
      status: 409,
      details: { message: "This run is signed off. Reopen it to make changes." },
    });
    expect(isStaleRunConflict(cause)).toBe(false);
  });

  it("flags a stale rowVersion 409 so the view can offer a reload", () => {
    const stale = apiError(409, "Item rowVersion is stale");
    expect(isStaleRunConflict(stale)).toBe(true);
    expect(qaActionError(stale, "x")).toEqual({ message: "Item rowVersion is stale", stale: true });
    expect(isStaleRunConflict(apiError(409, "Run is signed off"))).toBe(false);
    const coded = Object.assign(new Error("x"), { status: 409, details: { code: "STALE_ROW_VERSION" } });
    expect(qaActionError(coded, "x")).toEqual({ message: STALE_RUN_MESSAGE, stale: true });
  });

  it("shows the server's own sentence for 409, 400 and 403", () => {
    expect(qaActionError(apiError(409, "No commit found for branch uat"), "x")).toEqual({
      message: "No commit found for branch uat",
      stale: false,
    });
    const validation = Object.assign(new Error("x"), {
      status: 400,
      details: { message: ["defectSeverity is required", "for failed items"] },
    });
    expect(qaActionError(validation, "x").message).toBe("defectSeverity is required for failed items");
    expect(qaActionError(apiError(403), "x").message).toBe("Your role cannot make this change.");
    expect(qaActionError(apiError(404), "x").message).toMatch(/no longer exists/);
    expect(qaActionError(new Error("network"), "fallback")).toEqual({ message: "fallback", stale: false });
  });
});
