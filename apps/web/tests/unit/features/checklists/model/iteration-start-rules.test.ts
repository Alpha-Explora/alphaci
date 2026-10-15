import {
  carryItemHint,
  carryOverGroups,
  carryRestartsProgress,
  carrySelectionLabel,
  normalizeCarryOver,
  selectAllUnfinished,
  selectedCarryIds,
  toggleCarryItem,
  unfinishedItemIds,
} from "../../../../../src/features/checklists/model/iteration-carry-over-rules";
import {
  deliveredBannerTitle,
  iterationStatusLabel,
  iterationTitle,
  normalizeCurrentIteration,
} from "../../../../../src/features/checklists/model/iteration-rules";
import {
  ITERATION_GOAL_MAX,
  iterationDeliveredOnText,
  iterationGoalError,
  iterationNextStep,
  normalizeStartedIteration,
  roleCanStartIteration,
  startErrorRefreshesOnClose,
  startIterationErrorMessage,
  startIterationInput,
  startIterationLabel,
  waitingForNextIterationText,
} from "../../../../../src/features/checklists/model/iteration-start-rules";
import type { CurrentIteration } from "../../../../../src/features/checklists/model/iteration-types";
import { carryOverWire, currentWire, DELIVERED_AT, deliveredWire, startableWire, waitingWire } from "../iteration-fixtures";
import { apiErrorWith } from "../qa-promotion-fixtures";

function current(wire: Record<string, unknown>): CurrentIteration {
  const normalized = normalizeCurrentIteration(wire);
  if (!normalized) throw new Error("fixture names no iteration");
  return normalized;
}

const WAITING_TEXT =
  "Iteration 3 was delivered on 14 Oct 2026. Waiting for the Product owner to start iteration 4.";

describe("normalizeCurrentIteration: the phase 3 fields", () => {
  it("reads canStartNext and, only with it, the carry-over candidates", () => {
    const startable = current(startableWire());
    expect(startable.canStartNext).toBe(true);
    expect(startable.carryOver?.fromIterationNumber).toBe(3);
    expect(startable.carryOver?.requirements.map((requirement) => requirement.items.length)).toEqual([2, 1]);

    const waiting = current(waitingWire({ carryOver: carryOverWire() }));
    expect(waiting.canStartNext).toBe(false);
    expect(waiting.carryOver).toBeNull();
  });

  it("an older backend: no canStartNext means null, and no carryOver means null", () => {
    const wire = deliveredWire();
    delete wire.canStartNext;
    expect(current(wire).canStartNext).toBeNull();
    expect(current(wire).carryOver).toBeNull();
    expect(current(deliveredWire({ canStartNext: true })).carryOver).toBeNull();
    expect(current(deliveredWire({ canStartNext: "yes" })).canStartNext).toBeNull();
  });
});

describe("normalizeCarryOver", () => {
  it("keeps every well-formed requirement and item, pre-selecting only an explicit suggested: true", () => {
    const carry = normalizeCarryOver({
      fromIterationNumber: 2,
      requirements: [
        {
          requirementId: "r1",
          name: " Checkout ",
          kind: "functional",
          items: [
            { id: "a", title: "A", progress: "weird", lastStatus: "nope", suggested: "true" },
            { title: "no id" },
          ],
        },
        { requirementId: "r2", name: "Empty", kind: "system", items: [] },
        { requirementId: "r3", name: "Bad kind", kind: "other", items: [{ id: "b" }] },
      ],
    });
    expect(carry).toEqual({
      fromIterationNumber: 2,
      requirements: [
        {
          requirementId: "r1",
          name: "Checkout",
          kind: "functional",
          items: [{ id: "a", title: "A", progress: "todo", lastStatus: null, suggested: false }],
        },
      ],
    });
  });

  it("is null without a source iteration number; an empty list is still an answer", () => {
    expect(normalizeCarryOver(null)).toBeNull();
    expect(normalizeCarryOver({ requirements: [] })).toBeNull();
    expect(normalizeCarryOver({ fromIterationNumber: 3 })).toEqual({ fromIterationNumber: 3, requirements: [] });
  });
});

describe("iterationNextStep", () => {
  it("offers Start to a Product owner or admin the server lets start, with the list", () => {
    expect(iterationNextStep(current(startableWire()), "lead", "en-GB")).toEqual({
      kind: "start",
      nextNumber: 4,
      text: "Iteration 3 was delivered on 14 Oct 2026.",
    });
    expect(iterationNextStep(current(startableWire()), "admin", "en-GB").kind).toBe("start");
  });

  it("tells everyone the server does not let start that they wait", () => {
    for (const role of ["qa", "member", "lead", null] as const) {
      expect(iterationNextStep(current(waitingWire()), role, "en-GB")).toEqual({ kind: "waiting", text: WAITING_TEXT });
    }
  });

  it("says nothing while an iteration is active, or when the server did not say", () => {
    expect(iterationNextStep(current(currentWire()), "lead")).toEqual({ kind: "none" });
    expect(iterationNextStep(current(currentWire({ canStartNext: false })), "qa")).toEqual({ kind: "none" });
    const older = deliveredWire();
    delete older.canStartNext;
    expect(iterationNextStep(current(older), "qa")).toEqual({ kind: "none" });
    // canStartNext without carryOver (a phase 2 backend): no Start.
    expect(iterationNextStep(current(deliveredWire({ canStartNext: true })), "lead")).toEqual({ kind: "none" });
    // A role the client does not know as a starter never sees Start.
    expect(iterationNextStep(current(startableWire()), "qa")).toEqual({ kind: "none" });
    expect(iterationNextStep(null, "lead")).toEqual({ kind: "none" });
  });

  it("names the roles that start iterations", () => {
    expect(["lead", "admin", "qa", "member", null, undefined].map(roleCanStartIteration)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("the sentences", () => {
  it("waiting, with and without a date", () => {
    expect(waitingForNextIterationText({ number: 3, deliveredAt: DELIVERED_AT }, "en-GB")).toBe(WAITING_TEXT);
    expect(waitingForNextIterationText({ number: 3, deliveredAt: null })).toBe(
      "Iteration 3 was delivered. Waiting for the Product owner to start iteration 4.",
    );
    expect(iterationDeliveredOnText({ number: 7, deliveredAt: "not a date" })).toBe("Iteration 7 was delivered.");
  });

  it("the Start label, and the goal where the iteration is named", () => {
    expect(startIterationLabel(4)).toBe("Start iteration 4");
    expect(iterationTitle({ number: 4, goal: "Loyalty points" })).toBe("Iteration 4 · Loyalty points");
    expect(iterationTitle({ number: 4, goal: "  " })).toBe("Iteration 4");
    expect(iterationStatusLabel({ number: 4, status: "active", deliveredAt: null, goal: "Loyalty points" })).toBe(
      "Iteration 4 · Loyalty points · Active",
    );
    expect(
      deliveredBannerTitle({ number: 4, deliveredAt: null, deliveredByLogin: "ana", goal: "Loyalty points" }),
    ).toBe("Iteration 4 · Loyalty points delivered by @ana");
  });
});

describe("the goal and the request", () => {
  it("allows up to 120 characters, trimmed", () => {
    expect(ITERATION_GOAL_MAX).toBe(120);
    expect(iterationGoalError("x".repeat(120))).toBeNull();
    expect(iterationGoalError(`  ${"x".repeat(120)}  `)).toBeNull();
    expect(iterationGoalError("x".repeat(121))).toBe("A goal is at most 120 characters.");
  });

  it("trims the goal, leaves it out when empty, and carries the ids", () => {
    expect(startIterationInput("  Loyalty points ", ["a", "b"])).toEqual({
      goal: "Loyalty points",
      carryOver: { requirementItemIds: ["a", "b"] },
    });
    expect(startIterationInput("   ", [])).toEqual({ carryOver: { requirementItemIds: [] } });
  });

  it("reads the 201 answer", () => {
    expect(
      normalizeStartedIteration({
        iteration: { id: "it-4", number: 4, status: "active", goal: "Loyalty points" },
        carriedRequirements: 2,
        carriedItems: 3,
      }),
    ).toEqual({
      iteration: { id: "it-4", number: 4, status: "active", goal: "Loyalty points", deliveredAt: null, deliveredByLogin: null },
      carriedRequirements: 2,
      carriedItems: 3,
    });
    expect(normalizeStartedIteration(null)).toEqual({ iteration: null, carriedRequirements: 0, carriedItems: 0 });
  });
});

describe("startIterationErrorMessage", () => {
  it("maps the codes to product sentences, naming the active iteration when it can", () => {
    expect(startIterationErrorMessage(apiErrorWith(409, { code: "ITERATION_ACTIVE", iterationNumber: 4 }))).toBe(
      "Iteration 4 is still active. Deliver it before starting the next one.",
    );
    expect(startIterationErrorMessage(apiErrorWith(409, { code: "ITERATION_ACTIVE" }))).toBe(
      "This Project already has an active iteration. Deliver it before starting the next one.",
    );
    expect(
      startIterationErrorMessage(
        apiErrorWith(400, { code: "ITERATION_CARRY_INVALID", message: "server words", invalidIds: ["x"] }),
      ),
    ).toBe(
      "Some selected items can no longer be carried over: only items of the last delivered iteration can be. Close this dialog, reload the page and choose again.",
    );
  });

  it("falls back on the status, then a retry, never the server's own words", () => {
    expect(startIterationErrorMessage(apiErrorWith(403, { message: "Forbidden resource" }))).toBe(
      "Only a Product owner or admin can start the next iteration.",
    );
    expect(startIterationErrorMessage(apiErrorWith(404))).toBe(
      "This Project could not be found, or this server cannot start iterations yet.",
    );
    expect(startIterationErrorMessage(apiErrorWith(401))).toBe(
      "Your session has ended. Sign in again to start the next iteration.",
    );
    expect(startIterationErrorMessage(apiErrorWith(500, { message: "boom" }))).toBe(
      "The next iteration could not be started. Try again in a moment.",
    );
    expect(startIterationErrorMessage(new Error("offline"))).toBe(
      "The next iteration could not be started. Try again in a moment.",
    );
  });

  it("re-reads the Project on close only after ITERATION_ACTIVE", () => {
    expect(startErrorRefreshesOnClose(apiErrorWith(409, { code: "ITERATION_ACTIVE" }))).toBe(true);
    expect(startErrorRefreshesOnClose(apiErrorWith(400, { code: "ITERATION_CARRY_INVALID" }))).toBe(false);
  });
});

describe("the carry-over selection", () => {
  const carry = normalizeCarryOver(carryOverWire());

  it("starts from the unfinished items, in list order", () => {
    expect(unfinishedItemIds(carry)).toEqual(["item-coupon", "item-csp"]);
    expect(unfinishedItemIds(null)).toEqual([]);
  });

  it("toggles, selects all unfinished without dropping extras, and sends only offered ids in order", () => {
    let selected: ReadonlySet<string> = new Set<string>();
    selected = toggleCarryItem(selected, "item-pay");
    expect([...selected]).toEqual(["item-pay"]);
    selected = selectAllUnfinished(selected, carry);
    expect(selectedCarryIds(selected, carry)).toEqual(["item-pay", "item-coupon", "item-csp"]);
    selected = toggleCarryItem(selected, "item-coupon");
    expect(selectedCarryIds(new Set([...selected, "stale-id"]), carry)).toEqual(["item-pay", "item-csp"]);
  });

  it("words each item: progress, QA status, and the P13 restart", () => {
    expect(carryItemHint({ progress: "done", lastStatus: "passed" })).toBe("Done · QA: Passed");
    expect(carryItemHint({ progress: "done", lastStatus: "returned_to_dev" })).toBe(
      "Done · QA: Returned to dev · restarts In progress",
    );
    expect(carryItemHint({ progress: "in_progress", lastStatus: null })).toBe("In progress · Not in the QA run");
    expect(["failed", "blocked", "returned_to_dev", "passed", "pending", null].map((lastStatus) =>
      carryRestartsProgress({ lastStatus: lastStatus as never }),
    )).toEqual([true, true, true, false, false, false]);
    expect(carrySelectionLabel(2, 3)).toBe("2 of 3 items selected");
    expect(carrySelectionLabel(0, 1)).toBe("0 of 1 item selected");
  });

  it("groups the list by requirement with its kind and each checkbox", () => {
    const groups = carryOverGroups(carry, new Set(["item-csp"]));
    expect(groups.map((group) => [group.kindLabel, group.name, group.items.map((item) => [item.id, item.checked])])).toEqual([
      ["Feature", "Checkout", [["item-pay", false], ["item-coupon", false]]],
      ["System requirement", "Security headers", [["item-csp", true]]],
    ]);
    expect(carryOverGroups(null, new Set())).toEqual([]);
  });
});
