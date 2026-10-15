import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";

import { iterationsRepository } from "../../../../../src/features/checklists/data/iterations-repository";
import {
  useCurrentIterationViewModel,
  useStartIterationViewModel,
  type StartIterationViewModel,
} from "../../../../../src/features/checklists/iteration";
import { normalizeCurrentIteration } from "../../../../../src/features/checklists/model/iteration-rules";
import type { StartedIteration } from "../../../../../src/features/checklists/model/iteration-types";
import type { AppRole } from "../../../../../src/shared/api/contracts";
import { currentWire, startableWire, waitingWire } from "../iteration-fixtures";
import { apiErrorWith } from "../qa-promotion-fixtures";

jest.mock("../../../../../src/features/checklists/data/iterations-repository", () => ({
  iterationsRepository: { current: jest.fn(), mergeAll: jest.fn(), start: jest.fn() },
}));

const iterations = iterationsRepository as jest.Mocked<typeof iterationsRepository>;

const STARTED: StartedIteration = {
  iteration: { id: "it-4", number: 4, status: "active", goal: "Loyalty points", deliveredAt: null, deliveredByLogin: null },
  carriedRequirements: 2,
  carriedItems: 2,
};

/* The ViewModel under test, read after every render (never reassigned while rendering). */
const latest: { vm: StartIterationViewModel | null } = { vm: null };

function Harness({
  role,
  deliveryProjectId,
  onStarted,
}: Readonly<{ role: AppRole; deliveryProjectId: string; onStarted?: (started: StartedIteration) => void }>) {
  const iteration = useCurrentIterationViewModel({ deliveryProjectId, enabled: true });
  const vm = useStartIterationViewModel({ deliveryProjectId, current: iteration.current, appRole: role, onStarted });
  useEffect(() => {
    latest.vm = vm;
  });
  return null;
}

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  latest.vm = null;
  jest.clearAllMocks();
});

/** Lets every pending read and write settle, inside act. */
async function settle() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** Polls (inside act) until the ViewModel says what the test waits for. */
async function until(check: (vm: StartIterationViewModel) => boolean): Promise<StartIterationViewModel> {
  for (let i = 0; i < 40; i += 1) {
    if (latest.vm && check(latest.vm)) return latest.vm;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error("the ViewModel never reached the expected state");
}

async function mount(role: AppRole, options: { project?: string; onStarted?: (started: StartedIteration) => void } = {}) {
  const container = document.createElement("div");
  root = createRoot(container);
  await act(async () => {
    root!.render(<Harness role={role} deliveryProjectId={options.project ?? "dp-1"} onStarted={options.onStarted} />);
  });
  await settle();
}

function vm(): StartIterationViewModel {
  if (!latest.vm) throw new Error("not rendered");
  return latest.vm;
}

async function run(action: (vm: StartIterationViewModel) => unknown) {
  await act(async () => {
    await action(vm());
  });
  await settle();
}

function checked(): string[] {
  return vm().groups.flatMap((group) => group.items.filter((item) => item.checked).map((item) => item.id));
}

describe("useStartIterationViewModel", () => {
  it("offers Start iteration 4 to a Product owner and opens with the unfinished items pre-checked", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    await mount("lead");
    expect(vm().step.kind).toBe("start");
    expect(vm().label).toBe("Start iteration 4");
    expect(vm().open).toBe(false);
    await run((model) => model.openDialog());
    expect(vm().open).toBe(true);
    expect(vm().fromIterationNumber).toBe(3);
    expect(checked()).toEqual(["item-coupon", "item-csp"]);
    expect(vm().selectionLabel).toBe("2 of 3 items selected");
    expect(vm().unfinishedCount).toBe(2);
  });

  it("clears, ticks one, and selects all unfinished again without dropping the extra one", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    await mount("admin");
    await run((model) => model.openDialog());
    await run((model) => model.clear());
    expect(checked()).toEqual([]);
    expect(vm().selectedCount).toBe(0);
    await run((model) => model.toggleItem("item-pay"));
    await run((model) => model.selectAllUnfinished());
    expect(checked()).toEqual(["item-pay", "item-coupon", "item-csp"]);
    await run((model) => model.toggleItem("item-coupon"));
    expect(checked()).toEqual(["item-pay", "item-csp"]);
  });

  it("submits the trimmed goal and the ticked ids, closes, and re-reads the Project", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    iterations.start.mockResolvedValue(STARTED);
    const onStarted = jest.fn();
    await mount("lead", { project: "dp-submit", onStarted });
    expect(iterations.current).toHaveBeenCalledTimes(1);
    await run((model) => model.openDialog());
    await run((model) => model.setGoal("  Loyalty points  "));
    iterations.current.mockResolvedValue(normalizeCurrentIteration(currentWire({ iteration: { id: "it-4", number: 4, status: "active", goal: "Loyalty points" } })));
    await run((model) => model.submit());
    expect(iterations.start).toHaveBeenCalledWith("dp-submit", {
      goal: "Loyalty points",
      carryOver: { requirementItemIds: ["item-coupon", "item-csp"] },
    });
    expect(onStarted).toHaveBeenCalledWith(STARTED);
    expect(vm().open).toBe(false);
    expect(iterations.current).toHaveBeenCalledTimes(2);
    // The new iteration is active: nothing about a next one any more.
    expect((await until((model) => model.step.kind === "none")).label).toBe("");
  });

  it("starts empty when nothing is ticked, leaving the goal out", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    iterations.start.mockResolvedValue(STARTED);
    await mount("lead", { project: "dp-empty" });
    await run((model) => model.openDialog());
    await run((model) => model.clear());
    await run((model) => model.submit());
    expect(iterations.start).toHaveBeenCalledWith("dp-empty", { carryOver: { requirementItemIds: [] } });
  });

  it("keeps the dialog open with a product sentence when the server refuses", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    await mount("lead", { project: "dp-refused" });
    await run((model) => model.openDialog());

    iterations.start.mockRejectedValueOnce(apiErrorWith(400, { code: "ITERATION_CARRY_INVALID", invalidIds: ["item-csp"] }));
    await run((model) => model.submit());
    expect(vm().open).toBe(true);
    expect(vm().submitting).toBe(false);
    expect(vm().error).toBe(
      "Some selected items can no longer be carried over: only items of the last delivered iteration can be. Close this dialog, reload the page and choose again.",
    );
    expect(checked()).toEqual(["item-coupon", "item-csp"]);

    iterations.start.mockRejectedValueOnce(apiErrorWith(409, { code: "ITERATION_ACTIVE", iterationNumber: 4 }));
    await run((model) => model.submit());
    expect(vm().open).toBe(true);
    expect(vm().error).toBe("Iteration 4 is still active. Deliver it before starting the next one.");

    // Someone else started it: closing reads the Project again.
    expect(iterations.current).toHaveBeenCalledTimes(1);
    await run((model) => model.close());
    expect(vm().open).toBe(false);
    expect(iterations.current).toHaveBeenCalledTimes(2);
  });

  it("does not send an over-long goal", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    await mount("lead");
    await run((model) => model.openDialog());
    await run((model) => model.setGoal("x".repeat(121)));
    expect(vm().goalError).toBe("A goal is at most 120 characters.");
    await run((model) => model.submit());
    expect(iterations.start).not.toHaveBeenCalled();
  });

  it("reopens fresh: no goal, the unfinished items ticked again", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    await mount("lead");
    await run((model) => model.openDialog());
    await run((model) => model.setGoal("Draft"));
    await run((model) => model.clear());
    await run((model) => model.close());
    await run((model) => model.openDialog());
    expect(vm().goal).toBe("");
    expect(checked()).toEqual(["item-coupon", "item-csp"]);
  });

  it("offers nothing to someone who waits, and never opens", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(waitingWire()));
    await mount("qa");
    expect(vm().step.kind).toBe("waiting");
    await run((model) => model.openDialog());
    expect(vm().open).toBe(false);
    expect(vm().groups).toEqual([]);
  });
});
