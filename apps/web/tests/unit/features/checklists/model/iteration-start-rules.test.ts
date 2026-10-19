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
  startIterationDescription,
  startIterationErrorMessage,
  startIterationInput,
  startIterationLabel,
  waitingForNextIterationText,
} from "../../../../../src/features/checklists/model/iteration-start-rules";
import type { CurrentVersion } from "../../../../../src/features/checklists/model/iteration-types";
import { currentWire, DELIVERED_AT, deliveredWire, startableWire, waitingWire } from "../iteration-fixtures";
import { apiErrorWith } from "../qa-promotion-fixtures";

function current(wire: Record<string, unknown>): CurrentVersion {
  const normalized = normalizeCurrentIteration(wire);
  if (!normalized) throw new Error("fixture names no iteration");
  return normalized;
}

const WAITING_TEXT =
  "Version 3 was delivered on 14 Oct 2026. Waiting for the Product owner to start version 4.";

describe("normalizeCurrentIteration: the phase 3 fields", () => {
  it("reads canStartNext, and nothing about carrying work over", () => {
    const startable = current(startableWire({ carryOver: { fromIterationNumber: 3, requirements: [] } }));
    expect(startable.canStartNext).toBe(true);
    expect(startable).not.toHaveProperty("carryOver");
    expect(current(waitingWire()).canStartNext).toBe(false);
  });

  it("an older backend: no canStartNext means null", () => {
    const wire = deliveredWire();
    delete wire.canStartNext;
    expect(current(wire).canStartNext).toBeNull();
    expect(current(deliveredWire({ canStartNext: "yes" })).canStartNext).toBeNull();
  });
});

describe("iterationNextStep", () => {
  it("offers Start to a Product owner or admin the server lets start", () => {
    expect(iterationNextStep(current(startableWire()), "lead", "en-GB")).toEqual({
      kind: "start",
      nextNumber: 4,
      text: "Version 3 was delivered on 14 Oct 2026.",
    });
    expect(iterationNextStep(current(startableWire()), "admin", "en-GB").kind).toBe("start");
  });

  it("tells everyone the server does not let start that they wait", () => {
    for (const role of ["qa", "member", "lead", null] as const) {
      expect(iterationNextStep(current(waitingWire()), role, "en-GB")).toEqual({ kind: "waiting", text: WAITING_TEXT });
    }
  });

  it("says nothing while a version is active, or when the server did not say", () => {
    expect(iterationNextStep(current(currentWire()), "lead")).toEqual({ kind: "none" });
    expect(iterationNextStep(current(currentWire({ canStartNext: false })), "qa")).toEqual({ kind: "none" });
    const older = deliveredWire();
    delete older.canStartNext;
    expect(iterationNextStep(current(older), "qa")).toEqual({ kind: "none" });
    // canStartNext alone is enough: no carry-over list is needed any more.
    expect(iterationNextStep(current(deliveredWire({ canStartNext: true })), "lead").kind).toBe("start");
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
      "Version 3 was delivered. Waiting for the Product owner to start version 4.",
    );
    expect(iterationDeliveredOnText({ number: 7, deliveredAt: "not a date" })).toBe("Version 7 was delivered.");
  });

  it("the Start label, and the goal where the version is named", () => {
    expect(startIterationLabel(4)).toBe("Start version 4");
    expect(iterationTitle({ number: 4, goal: "Loyalty points" })).toBe("Version 4 · Loyalty points");
    expect(iterationTitle({ number: 4, goal: "  " })).toBe("Version 4");
    expect(iterationStatusLabel({ number: 4, status: "active", deliveredAt: null, goal: "Loyalty points" })).toBe(
      "Version 4 · Loyalty points · Active",
    );
    expect(
      deliveredBannerTitle({ number: 4, deliveredAt: null, deliveredByLogin: "ana", goal: "Loyalty points" }),
    ).toBe("Version 4 · Loyalty points delivered by @ana");
  });
});

describe("the goal and the request", () => {
  it("allows up to 120 characters, trimmed", () => {
    expect(ITERATION_GOAL_MAX).toBe(120);
    expect(iterationGoalError("x".repeat(120))).toBeNull();
    expect(iterationGoalError(`  ${"x".repeat(120)}  `)).toBeNull();
    expect(iterationGoalError("x".repeat(121))).toBe("A goal is at most 120 characters.");
  });

  it("sends the trimmed goal only, left out when empty: nothing is carried over", () => {
    expect(startIterationInput("  Loyalty points ")).toEqual({ goal: "Loyalty points" });
    expect(startIterationInput("   ")).toEqual({});
  });

  it("reads the 201 answer", () => {
    expect(
      normalizeStartedIteration({
        iteration: { id: "it-4", number: 4, status: "active", goal: "Loyalty points" },
        carriedRequirements: 2,
      }),
    ).toEqual({
      iteration: { id: "it-4", number: 4, status: "active", goal: "Loyalty points", deliveredAt: null, deliveredByLogin: null },
    });
    expect(normalizeStartedIteration(null)).toEqual({ iteration: null });
  });

  it("says the new version starts empty and the delivered one keeps its work", () => {
    expect(startIterationDescription(2)).toBe(
      "Name what this version is for. Version 2 starts with an empty checklist: Version 1's requirements and QA results stay with Version 1, read-only.",
    );
  });
});

describe("startIterationErrorMessage", () => {
  it("maps the codes to product sentences, naming the active version when it can", () => {
    expect(startIterationErrorMessage(apiErrorWith(409, { code: "ITERATION_ACTIVE", iterationNumber: 4 }))).toBe(
      "Version 4 is still active. Deliver it before starting the next one.",
    );
    expect(startIterationErrorMessage(apiErrorWith(409, { code: "ITERATION_ACTIVE" }))).toBe(
      "This Project already has an active version. Deliver it before starting the next one.",
    );
    expect(
      startIterationErrorMessage(
        apiErrorWith(400, { code: "ITERATION_CARRY_INVALID", message: "server words", invalidIds: ["x"] }),
      ),
    ).toBe(
      "Items are no longer carried over: a new version starts with an empty checklist. Close this dialog, reload the page and start it again.",
    );
  });

  it("falls back on the status, then a retry, never the server's own words", () => {
    expect(startIterationErrorMessage(apiErrorWith(403, { message: "Forbidden resource" }))).toBe(
      "Only a Product owner or admin can start the next version.",
    );
    expect(startIterationErrorMessage(apiErrorWith(404))).toBe(
      "This Project could not be found, or this server cannot start versions yet.",
    );
    expect(startIterationErrorMessage(apiErrorWith(401))).toBe(
      "Your session has ended. Sign in again to start the next version.",
    );
    expect(startIterationErrorMessage(apiErrorWith(500, { message: "boom" }))).toBe(
      "The next version could not be started. Try again in a moment.",
    );
    expect(startIterationErrorMessage(new Error("offline"))).toBe(
      "The next version could not be started. Try again in a moment.",
    );
  });

  it("re-reads the Project on close only after ITERATION_ACTIVE", () => {
    expect(startErrorRefreshesOnClose(apiErrorWith(409, { code: "ITERATION_ACTIVE" }))).toBe(true);
    expect(startErrorRefreshesOnClose(apiErrorWith(400, { code: "ITERATION_CARRY_INVALID" }))).toBe(false);
  });
});
