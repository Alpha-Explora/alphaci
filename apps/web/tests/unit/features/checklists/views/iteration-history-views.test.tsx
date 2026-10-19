import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

import { iterationsRepository } from "../../../../../src/features/checklists/data/iterations-repository";
import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { IterationHistoryPanel } from "../../../../../src/features/checklists/history";
import { normalizeIterationHistory } from "../../../../../src/features/checklists/model/iteration-history-rules";
import { normalizeProjectRun } from "../../../../../src/features/checklists/model/project-run-rules";
import type { ProjectQaRun } from "../../../../../src/features/checklists/model/project-run-types";
import { apiErrorWith } from "../qa-promotion-fixtures";
import { projectRunWire, runItemWire } from "../requirement-fixtures";

jest.mock("../../../../../src/features/checklists/data/iterations-repository", () => ({
  iterationsRepository: { list: jest.fn() },
}));
jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: { get: jest.fn() },
}));

const versions = iterationsRepository as jest.Mocked<typeof iterationsRepository>;
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

async function click(element: Element | null | undefined) {
  if (!element) throw new Error("nothing to click");
  await act(async () => {
    (element as HTMLElement).click();
  });
  await settle();
}

const HISTORY = normalizeIterationHistory({
  iterations: [
    {
      id: "it-1",
      number: 1,
      status: "delivered",
      goal: null,
      startedAt: "2026-10-02T13:36:19.000Z",
      startedBy: { id: "u-1", login: "lloyd" },
      deliveredAt: "2026-10-15T04:59:26.000Z",
      deliveredBy: { id: "u-2", login: "ana" },
      signoffRunId: "run-9",
    },
    {
      id: "it-2",
      number: 2,
      status: "active",
      goal: "Loyalty points",
      startedAt: "2026-10-16T08:00:00.000Z",
      startedBy: { id: "u-1", login: "lloyd" },
      deliveredAt: null,
      deliveredBy: null,
      signoffRunId: null,
    },
  ],
});

function frozenRun(): ProjectQaRun {
  const run = normalizeProjectRun(
    projectRunWire({
      id: "run-9",
      status: "signed_off",
      signoff: {
        id: "s-1",
        verdict: "APPROVED",
        summary: "All verified on uat.",
        conditions: null,
        signedBy: { id: "u-qa", login: "ana-qa" },
        signedAt: "2026-10-15T04:58:07.000Z",
      },
      items: [
        runItemWire({ status: "passed" }),
        runItemWire({ id: "run-item-2", position: 1, title: "Checkout works", requirementId: "req-sys", requirementName: "Release smoke test", requirementKind: "system", status: "passed" }),
      ],
      iteration: { id: "it-1", number: 1, status: "delivered" },
    }),
  );
  if (!run) throw new Error("fixture is not a run");
  return run;
}

function panel(): ReactNode {
  return <IterationHistoryPanel deliveryProjectId="dp-1" projectName="Logistics2" enabled />;
}

function toggles(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>(".ihist-card__toggle")];
}

describe("IterationHistoryPanel", () => {
  it("lists every version newest first, each closed, with who delivered it", async () => {
    iterations.list.mockResolvedValue(HISTORY);
    const container = await render(panel());
    expect(iterations.list).toHaveBeenCalledWith("dp-1");
    expect(container.querySelector(".ihist__title")?.textContent).toBe("Logistics2 history");
    expect(toggles(container).map((toggle) => toggle.textContent)).toEqual([
      "Version 2 · Loyalty points",
      "Version 1",
    ]);
    expect(toggles(container).every((toggle) => toggle.getAttribute("aria-expanded") === "false")).toBe(true);
    expect(container.textContent).toMatch(/Delivered .+ by @ana/);
    // The pill says only the state: the title already names the iteration.
    expect([...container.querySelectorAll(".iteration-status__label")].map((pill) => pill.textContent)).toEqual([
      "Active",
      "Delivered",
    ]);
    expect(runs.get).not.toHaveBeenCalled();
  });

  it("never uses the legacy history-* class names, which globals.css styles as an error box", async () => {
    iterations.list.mockResolvedValue(HISTORY);
    runs.get.mockResolvedValue(frozenRun());
    const container = await render(panel());
    await click(toggles(container)[1]);
    const classes = [...container.querySelectorAll("[class]")].flatMap((element) => [...element.classList]);
    expect(classes.filter((name) => name.startsWith("history"))).toEqual([]);
  });

  it("opens a delivered version onto its frozen checklist and QA results, read once", async () => {
    iterations.list.mockResolvedValue(HISTORY);
    runs.get.mockResolvedValue(frozenRun());
    const container = await render(panel());
    const delivered = toggles(container)[1]!;

    await click(delivered);
    expect(delivered.getAttribute("aria-expanded")).toBe("true");
    expect(runs.get).toHaveBeenCalledWith("dp-1", "run-9");
    const body = document.getElementById(delivered.getAttribute("aria-controls")!)!;
    expect(body.hidden).toBe(false);
    expect(body.textContent).toContain("Approved");
    expect(body.textContent).toMatch(/Signed off by @ana-qa on /);
    expect(body.textContent).toContain("All verified on uat.");
    expect(body.textContent).toContain("2/2 passed");
    expect([...body.querySelectorAll(".ihist-group__name")].map((name) => name.textContent)).toEqual([
      "Checkout with saved cards",
      "Release smoke test",
    ]);
    expect(body.textContent).toContain("As a shopper, I can pay with a saved card");
    // Read-only: nothing to press inside but the cards' own toggles.
    expect(body.querySelectorAll("button, input, select, textarea")).toHaveLength(0);

    await click(delivered);
    await click(delivered);
    expect(runs.get).toHaveBeenCalledTimes(1);
  });

  it("shows the QA Team and Product owners the Project, not the commits each repository was verified at", async () => {
    iterations.list.mockResolvedValue(HISTORY);
    runs.get.mockResolvedValue(frozenRun());
    for (const role of ["qa", "lead", "admin"] as const) {
      const container = await render(
        <IterationHistoryPanel deliveryProjectId="dp-1" projectName="Logistics2" enabled appRole={role} />,
      );
      await click(toggles(container)[1]);
      expect(container.querySelector(".ihist-heads") === null).toBe(role !== "admin");
      expect(container.textContent).toContain("2/2 passed");
      act(() => root?.unmount());
      root = null;
    }
  });

  it("points the active version to the Checklists tab", async () => {
    iterations.list.mockResolvedValue(HISTORY);
    const container = await render(panel());
    await click(toggles(container)[0]);
    expect(container.textContent).toContain(
      "This version is in progress. Its requirements, progress and QA testing are on the Checklists tab.",
    );
    expect(runs.get).not.toHaveBeenCalled();
  });

  it("offers a retry when a report cannot be read", async () => {
    iterations.list.mockResolvedValue(HISTORY);
    runs.get.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(frozenRun());
    const container = await render(panel());
    await click(toggles(container)[1]);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "This version's QA results could not be loaded.",
    );
    const retry = [...container.querySelectorAll("button")].find((button) => button.textContent === "Try again");
    await click(retry);
    expect(runs.get).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("2/2 passed");
  });

  it("says so on a backend without iterations, and when there are none yet", async () => {
    iterations.list.mockRejectedValue(apiErrorWith(404));
    const older = await render(panel());
    expect(older.textContent).toContain("This server does not keep versions yet.");
    act(() => root?.unmount());

    iterations.list.mockResolvedValue([]);
    const empty = await render(panel());
    expect(empty.textContent).toContain("No version yet.");
  });
});
