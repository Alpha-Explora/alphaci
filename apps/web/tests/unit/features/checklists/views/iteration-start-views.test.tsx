import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

import { iterationsRepository } from "../../../../../src/features/checklists/data/iterations-repository";
import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { IterationHeader } from "../../../../../src/features/checklists/iteration";
import { requirementsRepository } from "../../../../../src/features/checklists/data/requirements-repository";
import { normalizeCurrentIteration } from "../../../../../src/features/checklists/model/iteration-rules";
import { EMPTY_PROJECT_MY_ITEMS, normalizeProjectRunCurrent } from "../../../../../src/features/checklists/model/project-run-rules";
import { normalizePromotionStatus } from "../../../../../src/features/checklists/model/qa-promotion-rules";
import type { QaPromotionStatus } from "../../../../../src/features/checklists/model/qa-promotion-types";
import type { QaScope } from "../../../../../src/features/checklists/model/qa-scope";
import { normalizeProjectRequirements } from "../../../../../src/features/checklists/model/requirement-rules";
import { ProjectQaWorkspace } from "../../../../../src/features/checklists/requirements/views/project-qa-workspace";
import { MyQaItemsSummary } from "../../../../../src/features/checklists/returned/views/my-qa-items-summary";
import { ProjectMyItemsCard } from "../../../../../src/features/checklists/returned/views/project-my-items-card";
import { usePoDeliveryViewModel } from "../../../../../src/features/checklists/studio/view-models/use-po-delivery-view-model";
import { useProjectRunViewModel } from "../../../../../src/features/checklists/studio/view-models/use-project-run-view-model";
import type { ProjectRunViewModel } from "../../../../../src/features/checklists/studio/view-models/use-project-run-view-model";
import type { QaPromotionViewModel } from "../../../../../src/features/checklists/studio/view-models/use-qa-promotion-view-model";
import { PoAcceptancePanel } from "../../../../../src/features/checklists/studio/views/po-acceptance-panel";
import { ProjectRunPanel } from "../../../../../src/features/checklists/studio/views/project-run-panel";
import type { AppRole } from "../../../../../src/shared/api/contracts";
import { currentWire, deliveredWire, startableWire, waitingWire } from "../iteration-fixtures";
import { apiErrorWith, readyWire } from "../qa-promotion-fixtures";
import { projectRequirementsWire, projectRunWire } from "../requirement-fixtures";

jest.mock("../../../../../src/features/checklists/data/iterations-repository", () => ({
  iterationsRepository: { current: jest.fn(), mergeAll: jest.fn(), start: jest.fn() },
}));
jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: { current: jest.fn(), reopen: jest.fn(), myItems: jest.fn(), start: jest.fn() },
}));

jest.mock("../../../../../src/features/checklists/data/requirements-repository", () => ({
  requirementsRepository: { listForProject: jest.fn() },
}));

const iterations = iterationsRepository as jest.Mocked<typeof iterationsRepository>;
const runs = projectQaRunsRepository as jest.Mocked<typeof projectQaRunsRepository>;

/** "Version 3 was delivered on <date>. Waiting for the Product owner to start version 4." in any locale. */
const WAITING = /^Version 3 was delivered on .+\. Waiting for the Product owner to start version 4\.$/;

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
    expect(buttonNamed(container, "Start QA testing")).toBeUndefined();
    expect(buttonNamed(container, "Start version 4")).toBeUndefined();
  });

  it("tells a Developer the same", async () => {
    noRunYet();
    iterations.current.mockResolvedValue(normalizeCurrentIteration(waitingWire()));
    const container = await render(<RunHarness role="member" />);
    expect(waitingText(container)).toMatch(WAITING);
  });

  it("shows a Product owner Start version 4 instead of the waiting sentence", async () => {
    noRunYet();
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    const container = await render(<RunHarness role="lead" />);
    expect(waitingText(container)).toBeNull();
    expect(container.querySelector(".iteration-next__text")?.textContent).toMatch(/^Version 3 was delivered on .+\.$/);
    expect(buttonNamed(container, "+Start version 4")).toBeDefined();
    expect(buttonNamed(container, "Start QA testing")).toBeUndefined();
  });

  it("adds the waiting sentence under a delivered run, which has left the tab", async () => {
    const wire = projectRunWire({ status: "signed_off", iteration: { id: "it-3", number: 3, status: "delivered" } });
    runs.current.mockResolvedValue(normalizeProjectRunCurrent({ run: wire, heads: [] }));
    iterations.current.mockResolvedValue(normalizeCurrentIteration(waitingWire()));
    const container = await render(<RunHarness role="qa" />);
    expect(container.querySelector(".pqa-delivered")).not.toBeNull();
    // No History on this screen: the sentence names where it is, without a button.
    expect(container.querySelector(".pqa-delivered__text")?.textContent).toContain("in the Release tab of each repository");
    expect(waitingText(container)).toMatch(WAITING);
  });

  it("is exactly as before while a version is active, and on an older backend", async () => {
    noRunYet();
    iterations.current.mockResolvedValue(normalizeCurrentIteration(currentWire()));
    const active = await render(<RunHarness role="qa" />);
    expect(waitingText(active)).toBeNull();
    expect(buttonNamed(active, "Start QA testing")).toBeDefined();
    act(() => root?.unmount());

    const older = deliveredWire();
    delete older.canStartNext;
    iterations.current.mockResolvedValue(normalizeCurrentIteration(older));
    const container = await render(<RunHarness role="qa" />);
    expect(waitingText(container)).toBeNull();
    expect(container.querySelector(".iteration-next")).toBeNull();
    act(() => root?.unmount());

    // canStartNext alone offers Start: no carry-over list is needed any more.
    iterations.current.mockResolvedValue(normalizeCurrentIteration(deliveredWire({ canStartNext: true })));
    const lead = await render(<RunHarness role="lead" />);
    expect(buttonNamed(lead, "+Start version 4")).toBeDefined();
    expect(waitingText(lead)).toBeNull();
  });
});

/* ── The Checklists tab's one view, between versions ─────────────────── */

describe("The Checklists tab between iterations", () => {
  const requirements = requirementsRepository as jest.Mocked<typeof requirementsRepository>;

  function workspace(role: AppRole) {
    return <ProjectQaWorkspace deliveryProjectId="dp-1" projectName="storefront" appRole={role} />;
  }

  /* The Progress tab a Product owner no longer has also offered Start: the
   * requirements say the version was delivered and offer it once. */
  it("offers a Product owner Start version 4 once, on the requirements it writes", async () => {
    noRunYet();
    requirements.listForProject.mockResolvedValue(normalizeProjectRequirements(projectRequirementsWire()));
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    const container = await render(workspace("lead"));
    const starts = [...container.querySelectorAll("button")].filter((b) => b.textContent?.trim() === "+Start version 4");
    expect(starts).toHaveLength(1);
    expect(container.querySelector(".rq-panel .rq-delivered")).not.toBeNull();
  });

  it("tells a Developer who the team waits for, once, on its checklist", async () => {
    noRunYet();
    runs.myItems.mockResolvedValue(EMPTY_PROJECT_MY_ITEMS);
    requirements.listForProject.mockResolvedValue(normalizeProjectRequirements(projectRequirementsWire()));
    iterations.current.mockResolvedValue(normalizeCurrentIteration(waitingWire()));
    const container = await render(workspace("member"));
    expect(waitingText(container)).toMatch(WAITING);
    expect(container.querySelectorAll(".iteration-waiting__text")).toHaveLength(1);
  });

  it("adds nothing above the requirements while a version is active", async () => {
    noRunYet();
    requirements.listForProject.mockResolvedValue(normalizeProjectRequirements(projectRequirementsWire()));
    iterations.current.mockResolvedValue(normalizeCurrentIteration(currentWire()));
    const container = await render(workspace("lead"));
    expect(buttonNamed(container, "+Start version 4")).toBeUndefined();
    expect(waitingText(container)).toBeNull();
  });
});

/* ── The Start dialog, through the screen ───────────────────────────────── */

describe("Start version 4: the dialog", () => {
  it("asks only for a goal, says the version starts empty, and starts it", async () => {
    noRunYet();
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    iterations.start.mockResolvedValue({ iteration: null });
    const container = await render(<RunHarness role="lead" />);
    await click(buttonNamed(container, "+Start version 4"));
    const open = dialog();
    expect(open?.querySelector("h2")?.textContent).toBe("Start version 4");
    expect(open?.textContent).toContain(
      "Version 4 starts with an empty checklist: Version 3's requirements and QA results stay with Version 3, read-only.",
    );
    // No carry-over list: no checkboxes at all.
    expect(open?.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(buttonNamed(open!, "Select all unfinished")).toBeUndefined();

    await type(open!.querySelector<HTMLInputElement>(".iteration-goal input")!, "Loyalty points");
    iterations.current.mockResolvedValue(
      normalizeCurrentIteration(currentWire({ iteration: { id: "it-4", number: 4, status: "active", goal: "Loyalty points" } })),
    );
    runs.current.mockClear();
    await click(buttonNamed(open!, "Start version 4"));
    expect(iterations.start).toHaveBeenCalledWith("dp-1", { goal: "Loyalty points" });
    expect(await dialogGone()).toBe(true);
    // The QA run reads again: the new version lets QA start a fresh run.
    expect(runs.current).toHaveBeenCalled();
    expect(buttonNamed(container, "Start QA testing")).toBeDefined();
    expect(buttonNamed(container, "+Start version 4")).toBeUndefined();
  });

  it("keeps the dialog open and says why when the server refuses", async () => {
    noRunYet();
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    iterations.start.mockRejectedValue(apiErrorWith(409, { code: "ITERATION_ACTIVE", iterationNumber: 4 }));
    const container = await render(<RunHarness role="admin" />);
    await click(buttonNamed(container, "+Start version 4"));
    await click(buttonNamed(dialog()!, "Start version 4"));
    expect(dialog()).not.toBeNull();
    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe(
      "Version 4 is still active. Deliver it before starting the next one.",
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

function PoColumn({ role, reload }: Readonly<{ role: AppRole; reload: () => void }>) {
  const promotion = promotionVm(DELIVERED, reload);
  const delivery = usePoDeliveryViewModel({ deliveryProjectId: "dp-1", enabled: true, projectId: "proj-fe", appRole: role, promotion });
  return <PoAcceptancePanel qaScope={SCOPE} projectRun={NO_RUN} promotion={promotion} delivery={delivery} appRole={role} />;
}

function po(role: AppRole, reload: () => void = jest.fn()) {
  return <PoColumn role={role} reload={reload} />;
}

describe("PO Studio's delivered banner", () => {
  it("offers a Product owner Start version 4, and a start re-reads the promotion status", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    iterations.start.mockResolvedValue({ iteration: null });
    const reload = jest.fn();
    const container = await render(po("lead", reload));
    const banner = container.querySelector(".po-delivered");
    const start = buttonNamed(banner!, "+Start version 4");
    expect(start).toBeDefined();
    await click(start);
    await click(buttonNamed(dialog()!, "Start version 4"));
    expect(iterations.start).toHaveBeenCalledWith("dp-1", {});
    expect(reload).toHaveBeenCalled();
  });

  it("says who it waits for to anyone the server does not let start", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(waitingWire()));
    const container = await render(po("lead"));
    expect(waitingText(container.querySelector(".po-delivered")!)).toMatch(WAITING);
    expect(buttonNamed(container, "+Start version 4")).toBeUndefined();
  });

  it("adds nothing on a backend that does not say who may start", async () => {
    const older = deliveredWire();
    delete older.canStartNext;
    iterations.current.mockResolvedValue(normalizeCurrentIteration(older));
    const container = await render(po("lead"));
    expect(container.querySelector(".po-delivered")).not.toBeNull();
    expect(container.querySelector(".po-delivered__next")).toBeNull();
  });
});

/* ── The Project page's header ──────────────────────────────────────────── */

describe("IterationHeader (the Project page)", () => {
  it("shows the pill and, for a Product owner or admin, Start version 4", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(startableWire()));
    const lead = await render(<IterationHeader deliveryProjectId="dp-1" enabled appRole="lead" />);
    expect(lead.querySelector(".iteration-status")?.getAttribute("data-status")).toBe("delivered");
    expect(buttonNamed(lead, "+Start version 4")).toBeDefined();
    act(() => root?.unmount());

    iterations.current.mockResolvedValue(normalizeCurrentIteration(waitingWire()));
    const qa = await render(<IterationHeader deliveryProjectId="dp-1" enabled appRole="qa" />);
    expect(qa.querySelector(".iteration-status")).not.toBeNull();
    expect(buttonNamed(qa, "+Start version 4")).toBeUndefined();
    expect(waitingText(qa)).toBeNull();
  });

  it("names the goal once the next version is active", async () => {
    iterations.current.mockResolvedValue(
      normalizeCurrentIteration(currentWire({ iteration: { id: "it-4", number: 4, status: "active", goal: "Loyalty points" } })),
    );
    const container = await render(<IterationHeader deliveryProjectId="dp-1" enabled appRole="lead" />);
    expect(container.querySelector(".iteration-status")?.textContent).toBe("Version 4 · Loyalty points · Active");
    expect(buttonNamed(container, "+Start version 4")).toBeUndefined();
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
    expect(buttonNamed(container, "+Start version 4")).toBeDefined();
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

  it("the summary stays quiet while a version is active and nothing is assigned", async () => {
    runs.myItems.mockResolvedValue(EMPTY_PROJECT_MY_ITEMS);
    iterations.current.mockResolvedValue(normalizeCurrentIteration(currentWire()));
    const container = await render(
      <MyQaItemsSummary projectId="proj-fe" enabled qaScope={PROJECT_SCOPE} onOpenChecklists={jest.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
