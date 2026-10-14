import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

import { iterationsRepository } from "../../../../../src/features/checklists/data/iterations-repository";
import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { requirementsRepository } from "../../../../../src/features/checklists/data/requirements-repository";
import { IterationStatus } from "../../../../../src/features/checklists/iteration";
import { normalizeCurrentIteration } from "../../../../../src/features/checklists/model/iteration-rules";
import { normalizeProjectRunCurrent } from "../../../../../src/features/checklists/model/project-run-rules";
import { normalizePromotionStatus } from "../../../../../src/features/checklists/model/qa-promotion-rules";
import type { QaPromotionStatus } from "../../../../../src/features/checklists/model/qa-promotion-types";
import type { QaScope } from "../../../../../src/features/checklists/model/qa-scope";
import { normalizeProjectRequirements } from "../../../../../src/features/checklists/model/requirement-rules";
import { ProjectRequirementsPanel } from "../../../../../src/features/checklists/requirements/views/project-requirements-panel";
import { useProjectRunViewModel } from "../../../../../src/features/checklists/studio/view-models/use-project-run-view-model";
import type { ProjectRunViewModel } from "../../../../../src/features/checklists/studio/view-models/use-project-run-view-model";
import type { QaPromotionViewModel } from "../../../../../src/features/checklists/studio/view-models/use-qa-promotion-view-model";
import { PoAcceptancePanel } from "../../../../../src/features/checklists/studio/views/po-acceptance-panel";
import { ProjectRunPanel } from "../../../../../src/features/checklists/studio/views/project-run-panel";
import type { AppRole } from "../../../../../src/shared/api/contracts";
import { currentWire, deliveredWire } from "../iteration-fixtures";
import { apiErrorWith, readyWire } from "../qa-promotion-fixtures";
import { projectRequirementsWire, projectRunWire } from "../requirement-fixtures";

jest.mock("../../../../../src/features/checklists/data/iterations-repository", () => ({
  iterationsRepository: { current: jest.fn(), mergeAll: jest.fn() },
}));
jest.mock("../../../../../src/features/checklists/data/requirements-repository", () => ({
  requirementsRepository: { listForProject: jest.fn() },
}));
jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: { current: jest.fn(), reopen: jest.fn() },
}));

const iterations = iterationsRepository as jest.Mocked<typeof iterationsRepository>;
const requirements = requirementsRepository as jest.Mocked<typeof requirementsRepository>;
const runs = projectQaRunsRepository as jest.Mocked<typeof projectQaRunsRepository>;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

async function settle() {
  for (let i = 0; i < 6; i += 1) {
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

/** Re-render the same root (a parent re-rendering with new props). */
async function rerender(node: ReactNode) {
  await act(async () => {
    root!.render(node);
  });
  await settle();
}

async function click(element: Element | null | undefined) {
  if (!element) throw new Error("nothing to click");
  await act(async () => {
    (element as HTMLElement).click();
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

const NOT_FOUND = apiErrorWith(404);

describe("IterationStatus (the Project header)", () => {
  it("shows the active iteration", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(currentWire()));
    const container = await render(<IterationStatus deliveryProjectId="dp-1" enabled />);
    const pill = container.querySelector(".iteration-status");
    expect(pill?.getAttribute("data-status")).toBe("active");
    expect(pill?.textContent).toBe("Iteration 3 · Active");
    expect(iterations.current).toHaveBeenCalledWith("dp-1");
  });

  it("shows when a delivered iteration was delivered", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(deliveredWire()));
    const container = await render(<IterationStatus deliveryProjectId="dp-1" enabled />);
    const pill = container.querySelector(".iteration-status");
    expect(pill?.getAttribute("data-status")).toBe("delivered");
    expect(pill?.textContent).toMatch(/^Iteration 3 · Delivered \S/);
  });

  it("renders nothing on an older backend (404), on a reply without an iteration, or when disabled", async () => {
    iterations.current.mockRejectedValue(NOT_FOUND);
    expect((await render(<IterationStatus deliveryProjectId="dp-1" enabled />)).innerHTML).toBe("");
    act(() => root?.unmount());
    iterations.current.mockResolvedValue(null);
    expect((await render(<IterationStatus deliveryProjectId="dp-1" enabled />)).innerHTML).toBe("");
    act(() => root?.unmount());
    iterations.current.mockClear();
    expect((await render(<IterationStatus deliveryProjectId="dp-1" enabled={false} />)).innerHTML).toBe("");
    expect(iterations.current).not.toHaveBeenCalled();
  });
});

function RunHarness({ role }: Readonly<{ role: AppRole }>) {
  const vm = useProjectRunViewModel({ deliveryProjectId: "dp-1", enabled: true });
  return <ProjectRunPanel deliveryProjectId="dp-1" vm={vm} appRole={role} />;
}

describe("QA Studio's run on a delivered iteration", () => {
  it("says the iteration was delivered, and nothing looks clickable", async () => {
    const wire = projectRunWire({
      status: "signed_off",
      signoff: { id: "so-1", verdict: "APPROVED", signedAt: "2026-10-13T10:00:00.000Z", signedBy: { id: "u", login: "ana-qa" }, conditions: null },
      permissions: { canSetVerification: true, canSignOff: true, canReopen: true, canDispatch: true },
      iteration: { id: "it-3", number: 3, status: "delivered" },
    });
    runs.current.mockResolvedValue(normalizeProjectRunCurrent({ run: wire, heads: [] }));
    const container = await render(<RunHarness role="admin" />);
    expect(container.querySelector(".iteration-locked")?.textContent).toBe("Iteration 3 was delivered. Changes are locked.");
    const enabled = [...container.querySelectorAll<HTMLButtonElement>(".pqa-verify button")].filter((button) => !button.disabled);
    expect(enabled).toEqual([]);
    expect(buttonNamed(container, "Reopen")).toBeUndefined();
    expect(buttonNamed(container, "Sign off")).toBeUndefined();
  });

  it("shows no banner on an active iteration or an older backend", async () => {
    runs.current.mockResolvedValue(normalizeProjectRunCurrent({ run: projectRunWire({ iteration: { id: "it-3", number: 3, status: "active" } }), heads: [] }));
    const container = await render(<RunHarness role="qa" />);
    expect(container.querySelector(".iteration-locked")).toBeNull();
    expect([...container.querySelectorAll<HTMLButtonElement>(".pqa-verify button")].some((button) => !button.disabled)).toBe(true);
  });
});

function loadRequirements() {
  requirements.listForProject.mockResolvedValue(
    normalizeProjectRequirements(projectRequirementsWire({ permissions: { canManage: true, canSetProgress: true } })),
  );
}

describe("Project requirements on a delivered iteration", () => {
  it("are read-only with the banner", async () => {
    loadRequirements();
    iterations.current.mockResolvedValue(normalizeCurrentIteration(deliveredWire()));
    const container = await render(<ProjectRequirementsPanel deliveryProjectId="dp-1" appRole="lead" />);
    expect(container.querySelector(".iteration-locked")?.textContent).toBe("Iteration 3 was delivered. Changes are locked.");
    expect(buttonNamed(container, "New Feature")).toBeUndefined();
    expect(buttonNamed(container, "Add user story")).toBeUndefined();
    expect(container.querySelectorAll('button[aria-label^="Move "]').length).toBe(0);
  });

  it("are exactly as before on an active iteration or without the route", async () => {
    loadRequirements();
    iterations.current.mockRejectedValue(NOT_FOUND);
    const container = await render(<ProjectRequirementsPanel deliveryProjectId="dp-1" appRole="lead" />);
    expect(container.querySelector(".iteration-locked")).toBeNull();
    expect(buttonNamed(container, "New Feature")).toBeDefined();
    expect(buttonNamed(container, "Add user story")).toBeDefined();
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

function po(promotion: QaPromotionViewModel, role: AppRole = "lead") {
  return (
    <PoAcceptancePanel qaScope={SCOPE} projectId="proj-fe" projectRun={NO_RUN} promotion={promotion} appRole={role} />
  );
}

const READY = normalizePromotionStatus(readyWire({ scope: "project", repositoryDelivered: false }));

describe("PO Studio: Merge all repositories", () => {
  it("shows each covered repository's stored state and offers Merge all to a Product owner", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(currentWire()));
    const container = await render(po(promotionVm(READY)));
    const rows = [...container.querySelectorAll(".po-delivery__row")].map((row) => row.textContent);
    expect(rows).toEqual(["tone/storefront-webMerged into main", "tone/orders-apiNot in main yet"]);
    expect(buttonNamed(container, "Merge all repositories")).toBeDefined();
  });

  it("does not offer it to the QA Team, nor when the server says no", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(currentWire()));
    const qa = await render(po(promotionVm(READY), "qa"));
    expect(buttonNamed(qa, "Merge all repositories")).toBeUndefined();
    act(() => root?.unmount());
    iterations.current.mockResolvedValue(normalizeCurrentIteration(currentWire({ canMergeAll: false })));
    const lead = await render(po(promotionVm(READY)));
    expect(buttonNamed(lead, "Merge all repositories")).toBeUndefined();
  });

  it("confirms, shows each repository's result, and retries only after a partial failure", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(currentWire()));
    const reload = jest.fn();
    const container = await render(po(promotionVm(READY, reload)));
    await click(buttonNamed(container, "Merge all repositories"));
    expect(dialog()?.textContent).toContain("tone/orders-api");
    iterations.mergeAll.mockResolvedValueOnce({
      repositories: [
        { projectId: "proj-be", repoFullName: "tone/orders-api", merged: false, how: null, message: "At least 1 approving review is required." },
      ],
      delivered: false,
      iteration: null,
    });
    await click(buttonNamed(dialog()!, "Merge all repositories"));
    expect(iterations.mergeAll).toHaveBeenCalledWith("dp-1");
    expect(await dialogGone()).toBe(true);
    expect(container.textContent).toContain("0 of 1 repositories reached main. Retry merges only the rest.");
    expect(container.textContent).toContain("At least 1 approving review is required.");
    expect(reload).toHaveBeenCalled();
    expect(iterations.current).toHaveBeenCalledTimes(2);

    iterations.mergeAll.mockResolvedValueOnce({
      repositories: [{ projectId: "proj-be", repoFullName: "tone/orders-api", merged: true, how: "merged", message: null }],
      delivered: true,
      iteration: null,
    });
    await click(buttonNamed(container, "Retry the rest"));
    expect(iterations.mergeAll).toHaveBeenCalledTimes(2);
    expect(await dialogGone()).toBe(true);
    expect(container.textContent).toContain("Iteration delivered.");
  });

  it("explains a refusal in product words", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(currentWire()));
    iterations.mergeAll.mockRejectedValue(apiErrorWith(409, { code: "ITERATION_DELIVERED", iterationNumber: 3 }));
    const container = await render(po(promotionVm(READY)));
    await click(buttonNamed(container, "Merge all repositories"));
    await click(buttonNamed(dialog()!, "Merge all repositories"));
    expect(await dialogGone()).toBe(true);
    expect(container.textContent).toContain("Already delivered");
    expect(container.textContent).toContain("Iteration 3 was delivered, so its requirements and QA are locked.");
  });

  it("is exactly as before on a backend without iterations", async () => {
    iterations.current.mockRejectedValue(NOT_FOUND);
    const container = await render(po(promotionVm(READY)));
    expect(container.querySelector(".po-delivery")).toBeNull();
    expect(container.querySelector(".po-delivered")).toBeNull();
    expect(container.querySelector(".po-accept__status")?.textContent).toContain("Ready for production");
  });
});

describe("PO Studio: a delivered iteration", () => {
  const DELIVERED = normalizePromotionStatus(
    readyWire({
      scope: "project",
      eligible: false,
      iterationDelivered: true,
      repositoryDelivered: true,
      iteration: { id: "it-3", number: 3, status: "delivered", deliveredAt: "2026-10-14T10:00:00.000Z" },
    }),
  );

  it("replaces Merge with the delivered banner: who, when, and how each repository reached main", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(deliveredWire()));
    const container = await render(po(promotionVm(DELIVERED)));
    const banner = container.querySelector(".po-delivered");
    expect(banner?.textContent).toMatch(/Iteration 3 delivered on .+ by @ana/);
    const rows = [...banner!.querySelectorAll(".po-delivery__row")].map((row) => row.textContent);
    expect(rows).toEqual([
      "tone/storefront-webMerged into main · PR #12 · merge commit abc1234",
      "tone/orders-apiAlready in main",
    ]);
    expect(buttonNamed(container, "Merge all repositories")).toBeUndefined();
    expect(container.querySelector(".po-accept__status")).toBeNull();
  });

  it("still says delivered from the promotion status alone", async () => {
    iterations.current.mockRejectedValue(NOT_FOUND);
    const container = await render(po(promotionVm(DELIVERED)));
    expect(container.querySelector(".po-delivered__title")?.textContent).toMatch(/^Iteration 3 delivered on /);
  });

  it("re-reads the iteration when the promotion status changes", async () => {
    iterations.current.mockResolvedValue(normalizeCurrentIteration(currentWire()));
    await render(po(promotionVm(READY)));
    expect(iterations.current).toHaveBeenCalledTimes(1);
    iterations.current.mockResolvedValue(normalizeCurrentIteration(deliveredWire()));
    await rerender(po(promotionVm(DELIVERED)));
    expect(iterations.current).toHaveBeenCalledTimes(2);
    expect(document.querySelector(".po-delivered")).not.toBeNull();
  });
});
