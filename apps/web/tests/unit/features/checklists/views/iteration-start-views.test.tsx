import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

import { iterationsRepository } from "../../../../../src/features/checklists/data/iterations-repository";
import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { IterationHeader } from "../../../../../src/features/checklists/iteration";
import { normalizeCurrentIteration } from "../../../../../src/features/checklists/model/iteration-rules";
import { EMPTY_PROJECT_MY_ITEMS, normalizeProjectRunCurrent } from "../../../../../src/features/checklists/model/project-run-rules";
import { normalizePromotionStatus } from "../../../../../src/features/checklists/model/qa-promotion-rules";
import type { QaPromotionStatus } from "../../../../../src/features/checklists/model/qa-promotion-types";
import type { QaScope } from "../../../../../src/features/checklists/model/qa-scope";
import { MyQaItemsSummary } from "../../../../../src/features/checklists/returned/views/my-qa-items-summary";
import { ProjectMyItemsCard } from "../../../../../src/features/checklists/returned/views/project-my-items-card";
import { useProjectRunViewModel } from "../../../../../src/features/checklists/studio/view-models/use-project-run-view-model";
import type { ProjectRunViewModel } from "../../../../../src/features/checklists/studio/view-models/use-project-run-view-model";
import type { QaPromotionViewModel } from "../../../../../src/features/checklists/studio/view-models/use-qa-promotion-view-model";
import { PoAcceptancePanel } from "../../../../../src/features/checklists/studio/views/po-acceptance-panel";
import { ProjectRunPanel } from "../../../../../src/features/checklists/studio/views/project-run-panel";
import type { AppRole } from "../../../../../src/shared/api/contracts";
import { currentWire, deliveredWire, startableWire, waitingWire } from "../iteration-fixtures";
import { apiErrorWith, readyWire } from "../qa-promotion-fixtures";
import { projectRunWire } from "../requirement-fixtures";

jest.mock("../../../../../src/features/checklists/data/iterations-repository", () => ({
  iterationsRepository: { current: jest.fn(), mergeAll: jest.fn(), start: jest.fn() },
}));
jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: { current: jest.fn(), reopen: jest.fn(), myItems: jest.fn(), start: jest.fn() },
}));

const iterations = iterationsRepository as jest.Mocked<typeof iterationsRepository>;
const runs = projectQaRunsRepository as jest.Mocked<typeof projectQaRunsRepository>;

/** "Iteration 3 was delivered on <date>. Waiting for the Product owner to start iteration 4." in any locale. */
const WAITING = /^Iteration 3 was delivered on .+\. Waiting for the Product owner to start iteration 4\.$/;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

async function settle() {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function render(node: ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(node);
  });
  await settle();
  return container;
}

async function click(element: Element | null | undefined) {
  if (!element) throw new Error("nothing to click");
  await act(async () => {
    (element as HTMLElement).click();
  });
  await settle();
}

/** Types into a React-controlled input (the value setter React tracks, then an input event). */
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}

function buttonNamed(scope: ParentNode, name: string): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll("button")].find((button) => button.textContent?.trim() === name);
}

function dialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

/** Polls (inside act) until the closing dialog's exit animation has finished. */
async function dialogGone(): Promise<boolean> {
  for (let i = 0; i < 40 && dialog(); i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
  }
  return dialog() === null;
}

function waitingText(scope: ParentNode): string | null {
  return scope.querySelector(".iteration-waiting__text")?.textContent ?? null;
}

function checkedTitles(): string[] {
  return [...document.querySelectorAll<HTMLInputElement>(".iteration-carry__check")]
    .filter((box) => box.checked)
    .map((box) => box.closest("label")?.querySelector(".iteration-carry__title")?.textContent ?? "");
}

/* ── QA Studio and the Project's QA run tab (one panel) ───────────────── */

function RunHarness({ role }: Readonly<{ role: AppRole }>) {
  const vm = useProjectRunViewModel({ deliveryProjectId: "dp-1", enabled: true });
  return <ProjectRunPanel deliveryProjectId="dp-1" vm={vm} appRole={role} />;
}

function noRunYet() {
  runs.current.mockResolvedValue(normalizeProjectRunCurrent({ run: null, heads: [] }));
}

describe("The Project QA run between iterations", () => {
  it("tells the QA Team who it waits for, with no Start a run button", async () => {
    noRunYet();
    iterations.current.mockResolvedValue(normalizeCurrentIteration(waitingWire()));
    const container = await render(<RunHarness role="qa" />);
    expect(waitingText(container)).toMatch(WAITING);
    expect(buttonNamed(container, "Start Project QA run")).toBeUndefined();
    expect(buttonNamed(container, "Start iteration 4")).toBeUndefined();
  });

  it("tells a Developer the same", async () => {
    noRunYet();
    iterations.current.mockResolvedValue(normalizeCurrentIteration(waitingWire()));
    const container = await render(<RunHarness role="member" />);
    expect(waitingText(container)).toMatch(WAITING);
  });

  it("shows a Product owner Start iteration 4 instead of the waiting sentence", async () => {
    noRunYet();
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    const container = await render(<RunHarness role="lead" />);
    expect(waitingText(container)).toBeNull();
    expect(container.querySelector(".iteration-next__text")?.textContent).toMatch(/^Iteration 3 was delivered on .+\.$/);
    expect(buttonNamed(container, "+Start iteration 4")).toBeDefined();
    expect(buttonNamed(container, "Start Project QA run")).toBeUndefined();
  });

  it("adds the waiting sentence under a delivered run's locked banner", async () => {
    const wire = projectRunWire({ status: "signed_off", iteration: { id: "it-3", number: 3, status: "delivered" } });
    runs.current.mockResolvedValue(normalizeProjectRunCurrent({ run: wire, heads: [] }));
    iterations.current.mockResolvedValue(normalizeCurrentIteration(waitingWire()));
    const container = await render(<RunHarness role="qa" />);
    expect(container.querySelector(".iteration-locked")).not.toBeNull();
    expect(waitingText(container)).toMatch(WAITING);
  });

  it("is exactly as before while an iteration is active, and on an older backend", async () => {
    noRunYet();
    iterations.current.mockResolvedValue(normalizeCurrentIteration(currentWire()));
    const active = await render(<RunHarness role="qa" />);
    expect(waitingText(active)).toBeNull();
    expect(buttonNamed(active, "Start Project QA run")).toBeDefined();
    act(() => root?.unmount());

    const older = deliveredWire();
    delete older.canStartNext;
    iterations.current.mockResolvedValue(normalizeCurrentIteration(older));
    const container = await render(<RunHarness role="qa" />);
    expect(waitingText(container)).toBeNull();
    expect(container.querySelector(".iteration-next")).toBeNull();
    act(() => root?.unmount());

    // canStartNext without carryOver (a phase 2 backend): no Start for a Product owner.
    iterations.current.mockResolvedValue(normalizeCurrentIteration(deliveredWire({ canStartNext: true })));
    const lead = await render(<RunHarness role="lead" />);
    expect(buttonNamed(lead, "+Start iteration 4")).toBeUndefined();
    expect(waitingText(lead)).toBeNull();
  });
});

/* ── The Start dialog, through the screen ───────────────────────────────── */

describe("Start iteration 4: the dialog", () => {
  it("pre-checks the unfinished items, clears, re-selects, and starts with the goal", async () => {
    noRunYet();
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    iterations.start.mockResolvedValue({ iteration: null, carriedRequirements: 2, carriedItems: 2 });
    const container = await render(<RunHarness role="lead" />);
    await click(buttonNamed(container, "+Start iteration 4"));
    const open = dialog();
    expect(open?.querySelector("h2")?.textContent).toBe("Start iteration 4");
    expect(open?.textContent).toContain("Carry over from Iteration 3");
    expect([...open!.querySelectorAll(".iteration-carry__kind")].map((chip) => chip.textContent)).toEqual([
      "Feature",
      "System requirement",
    ]);
    expect(open?.textContent).toContain("Done · QA: Returned to dev · restarts In progress");
    expect(checkedTitles()).toEqual(["Apply a coupon", "Content-Security-Policy"]);
    expect(open?.textContent).toContain("2 of 3 items selected");

    await click(buttonNamed(open!, "Clear"));
    expect(checkedTitles()).toEqual([]);
    await click(buttonNamed(open!, "Select all unfinished"));
    expect(checkedTitles()).toEqual(["Apply a coupon", "Content-Security-Policy"]);

    await type(open!.querySelector<HTMLInputElement>(".iteration-goal input")!, "Loyalty points");
    iterations.current.mockResolvedValue(
      normalizeCurrentIteration(currentWire({ iteration: { id: "it-4", number: 4, status: "active", goal: "Loyalty points" } })),
    );
    runs.current.mockClear();
    await click(buttonNamed(open!, "Start iteration 4"));
    expect(iterations.start).toHaveBeenCalledWith("dp-1", {
      goal: "Loyalty points",
      carryOver: { requirementItemIds: ["item-coupon", "item-csp"] },
    });
    expect(await dialogGone()).toBe(true);
    // The QA run reads again: the new iteration lets QA start a fresh run.
    expect(runs.current).toHaveBeenCalled();
    expect(buttonNamed(container, "Start Project QA run")).toBeDefined();
    expect(buttonNamed(container, "+Start iteration 4")).toBeUndefined();
  });

  it("keeps the dialog open and says why when the server refuses", async () => {
    noRunYet();
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    iterations.start.mockRejectedValue(apiErrorWith(409, { code: "ITERATION_ACTIVE", iterationNumber: 4 }));
    const container = await render(<RunHarness role="admin" />);
    await click(buttonNamed(container, "+Start iteration 4"));
    await click(buttonNamed(dialog()!, "Start iteration 4"));
    expect(dialog()).not.toBeNull();
    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe(
      "Iteration 4 is still active. Deliver it before starting the next one.",
    );
  });
});

/* ── PO Studio ──────────────────────────────────────────────────────────── */

const SCOPE: QaScope = { kind: "project", deliveryProjectId: "dp-1", projectName: "Storefront", projectHref: null };

function promotionVm(data: QaPromotionStatus, reload: () => void = jest.fn()): QaPromotionViewModel {
  return {
    status: "ready",
    data,
    error: null,
    refreshing: false,
    canMerge: false,
    disabledReason: null,
    mergeState: "idle",
    dialogError: null,
    outcome: null,
    signInHref: "/login?next=/projects/proj-fe",
    openConfirm: jest.fn(),
    cancelConfirm: jest.fn(),
    confirmMerge: jest.fn(),
    dismissOutcome: jest.fn(),
    reload,
  };
}

const NO_RUN = { status: "ready", run: null, heads: [], stale: false, requirementsChanged: false } as unknown as ProjectRunViewModel;

const DELIVERED = normalizePromotionStatus(
  readyWire({
    scope: "project",
    eligible: false,
    iterationDelivered: true,
    repositoryDelivered: true,
    iteration: { id: "it-3", number: 3, status: "delivered", deliveredAt: "2026-10-14T10:00:00.000Z" },
  }),
);

function po(role: AppRole, reload: () => void = jest.fn()) {
  return (
    <PoAcceptancePanel
      qaScope={SCOPE}
      projectId="proj-fe"
      projectRun={NO_RUN}
      promotion={promotionVm(DELIVERED, reload)}
      appRole={role}
    />
  );
}

describe("PO Studio's delivered banner", () => {
  it("offers a Product owner Start iteration 4, and a start re-reads the promotion status", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    iterations.start.mockResolvedValue({ iteration: null, carriedRequirements: 0, carriedItems: 0 });
    const reload = jest.fn();
    const container = await render(po("lead", reload));
    const banner = container.querySelector(".po-delivered");
    const start = buttonNamed(banner!, "+Start iteration 4");
    expect(start).toBeDefined();
    await click(start);
    await click(buttonNamed(dialog()!, "Start iteration 4"));
    expect(iterations.start).toHaveBeenCalledWith("dp-1", { carryOver: { requirementItemIds: ["item-coupon", "item-csp"] } });
    expect(reload).toHaveBeenCalled();
  });

  it("says who it waits for to anyone the server does not let start", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(waitingWire()));
    const container = await render(po("lead"));
    expect(waitingText(container.querySelector(".po-delivered")!)).toMatch(WAITING);
    expect(buttonNamed(container, "+Start iteration 4")).toBeUndefined();
  });

  it("adds nothing on a backend without carry-over", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(deliveredWire({ canStartNext: true })));
    const container = await render(po("lead"));
    expect(container.querySelector(".po-delivered")).not.toBeNull();
    expect(container.querySelector(".po-delivered__next")).toBeNull();
  });
});

/* ── The Project page's header ──────────────────────────────────────────── */

describe("IterationHeader (the Project page)", () => {
  it("shows the pill and, for a Product owner or admin, Start iteration 4", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    const lead = await render(<IterationHeader deliveryProjectId="dp-1" enabled appRole="lead" />);
    expect(lead.querySelector(".iteration-status")?.getAttribute("data-status")).toBe("delivered");
    expect(buttonNamed(lead, "+Start iteration 4")).toBeDefined();
    act(() => root?.unmount());

    iterations.current.mockResolvedValue(normalizeCurrentIteration(waitingWire()));
    const qa = await render(<IterationHeader deliveryProjectId="dp-1" enabled appRole="qa" />);
    expect(qa.querySelector(".iteration-status")).not.toBeNull();
    expect(buttonNamed(qa, "+Start iteration 4")).toBeUndefined();
    expect(waitingText(qa)).toBeNull();
  });

  it("names the goal once the next iteration is active", async () => {
    iterations.current.mockResolvedValue(
      normalizeCurrentIteration(currentWire({ iteration: { id: "it-4", number: 4, status: "active", goal: "Loyalty points" } })),
    );
    const container = await render(<IterationHeader deliveryProjectId="dp-1" enabled appRole="lead" />);
    expect(container.querySelector(".iteration-status")?.textContent).toBe("Iteration 4 · Loyalty points · Active");
    expect(buttonNamed(container, "+Start iteration 4")).toBeUndefined();
  });

  it("renders nothing on a backend without iterations", async () => {
    iterations.current.mockRejectedValue(apiErrorWith(404));
    const container = await render(<IterationHeader deliveryProjectId="dp-1" enabled appRole="lead" />);
    expect(container.innerHTML).toBe("");
  });
});

/* ── My QA items (Developers) ───────────────────────────────────────────── */

const PROJECT_SCOPE: QaScope = { kind: "project", deliveryProjectId: "dp-1", projectName: "Storefront", projectHref: "/p" };

describe("My QA items between iterations", () => {
  it("the Project's list: the waiting sentence instead of empty buckets", async () => {
    runs.myItems.mockResolvedValue(EMPTY_PROJECT_MY_ITEMS);
    iterations.current.mockResolvedValue(normalizeCurrentIteration(waitingWire()));
    const container = await render(<ProjectMyItemsCard deliveryProjectId="dp-1" enabled appRole="member" />);
    expect(waitingText(container)).toMatch(WAITING);
    expect(container.textContent).not.toContain("Nothing here yet");
    expect(container.querySelector(".qa-mine__section")).toBeNull();
  });

  it("the Project's list for a Product owner: Start instead of the waiting sentence", async () => {
    runs.myItems.mockResolvedValue(EMPTY_PROJECT_MY_ITEMS);
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    const container = await render(<ProjectMyItemsCard deliveryProjectId="dp-1" enabled appRole="lead" />);
    expect(waitingText(container)).toBeNull();
    expect(buttonNamed(container, "+Start iteration 4")).toBeDefined();
  });

  it("the repository Overview's summary: the waiting sentence instead of the counts", async () => {
    runs.myItems.mockResolvedValue(EMPTY_PROJECT_MY_ITEMS);
    iterations.current.mockResolvedValue(normalizeCurrentIteration(waitingWire()));
    const container = await render(
      <MyQaItemsSummary projectId="proj-fe" enabled qaScope={PROJECT_SCOPE} onOpenChecklists={jest.fn()} />,
    );
    expect(waitingText(container)).toMatch(WAITING);
    expect(container.querySelector(".qa-summary__chips")).toBeNull();
  });

  it("the summary stays quiet while an iteration is active and nothing is assigned", async () => {
    runs.myItems.mockResolvedValue(EMPTY_PROJECT_MY_ITEMS);
    iterations.current.mockResolvedValue(normalizeCurrentIteration(currentWire()));
    const container = await render(
      <MyQaItemsSummary projectId="proj-fe" enabled qaScope={PROJECT_SCOPE} onOpenChecklists={jest.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
