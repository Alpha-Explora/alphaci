import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { qaRunsRepository } from "../../../../../src/features/checklists/data/qa-runs-repository";
import type { QaScope } from "../../../../../src/features/checklists/model/qa-scope";
import { MyQaItemsSummary } from "../../../../../src/features/checklists/returned/views/my-qa-items-summary";
import { MyQaItemsCard } from "../../../../../src/features/checklists/returned/views/my-qa-items-card";
import { runItem } from "../qa-run-fixtures";

jest.mock("../../../../../src/features/checklists/data/qa-runs-repository", () => ({
  qaRunsRepository: { myItems: jest.fn(), returnedItems: jest.fn() },
}));
jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: { myItems: jest.fn() },
}));

const runs = qaRunsRepository as jest.Mocked<typeof qaRunsRepository>;
const projectRuns = projectQaRunsRepository as jest.Mocked<typeof projectQaRunsRepository>;

const PROJECT_SCOPE: QaScope = {
  kind: "project",
  deliveryProjectId: "dp-1",
  projectName: "Checkout",
  projectHref: "/workflows?group=g-1&project=dp-1",
};

function entry(position: number, status: string) {
  return {
    runId: "run-1",
    branch: "uat",
    commitSha: "9f8e7d6c5b4a",
    checklistName: "Release smoke test",
    item: { ...runItem(position, { targetPersona: "developer" }), status },
  };
}

function feed(count: number) {
  return Array.from({ length: count }, (_, index) => ({ item: { id: `i-${index}` } }));
}

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

async function poll(check: () => boolean, attempts = 50): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error("condition not met");
}

async function render(props: Partial<React.ComponentProps<typeof MyQaItemsSummary>> = {}): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<MyQaItemsSummary projectId="p1" enabled onOpenChecklists={jest.fn()} {...props} />);
  });
  return container;
}

function chips(container: HTMLElement): Record<string, string> {
  return Object.fromEntries(
    [...container.querySelectorAll("li.qa-summary__chip")].map((chip) => [
      chip.getAttribute("data-bucket"),
      chip.querySelector(".qa-summary__chip-count")?.textContent ?? "",
    ]),
  );
}

describe("MyQaItemsSummary", () => {
  it("counts a repository's items per state, with no per-item rows or controls, and opens the Checklists tab", async () => {
    runs.myItems.mockResolvedValue({
      returned: [entry(0, "returned_to_dev")],
      developerItems: [entry(1, "pending"), entry(2, "in_progress"), entry(3, "passed")],
    } as never);
    const onOpenChecklists = jest.fn();
    const container = await render({ onOpenChecklists });
    await poll(() => container.querySelector("[data-testid='my-qa-items-summary']") !== null);

    expect(chips(container)).toEqual({ returned: "1", inProgress: "1", todo: "1", readyForQa: "1" });
    expect(container.textContent).toContain("Ready for QA");
    expect(container.querySelector(".qa-returned__row")).toBeNull();
    const labels = [...container.querySelectorAll("button")].map((b) => b.textContent);
    expect(labels).toEqual(["Open checklist"]);

    act(() => {
      [...container.querySelectorAll("button")][0].click();
    });
    expect(onOpenChecklists).toHaveBeenCalledTimes(1);
    expect(projectRuns.myItems).not.toHaveBeenCalled();
  });

  it("counts a Project's buckets and links to the Project's My QA items", async () => {
    projectRuns.myItems.mockResolvedValue({
      returned: feed(2),
      inProgress: feed(0),
      todo: feed(3),
      readyForQa: feed(1),
    } as never);
    const container = await render({ qaScope: PROJECT_SCOPE });
    await poll(() => container.querySelector("[data-testid='my-qa-items-summary']") !== null);

    expect(projectRuns.myItems).toHaveBeenCalledWith("dp-1");
    expect(runs.myItems).not.toHaveBeenCalled();
    expect(chips(container)).toEqual({ returned: "2", inProgress: "0", todo: "3", readyForQa: "1" });
    const link = container.querySelector("a.qa-summary__open");
    expect(link?.textContent).toBe("Open checklist");
    expect(link?.getAttribute("href")).toBe("/workflows?group=g-1&project=dp-1#my-qa-items");
  });

  /* An older backend: no Project-wide list, so the per-repository list is
   * counted and the button opens this repository's Checklists tab, which
   * carries that list. */
  it("falls back to the repository list and the Checklists tab when the Project list is missing", async () => {
    projectRuns.myItems.mockRejectedValue(Object.assign(new Error("Not found"), { status: 404 }));
    runs.myItems.mockResolvedValue({ returned: [entry(0, "returned_to_dev")], developerItems: [] } as never);
    const onOpenChecklists = jest.fn();
    const container = await render({ qaScope: PROJECT_SCOPE, onOpenChecklists });
    await poll(() => container.querySelector("[data-testid='my-qa-items-summary']") !== null);
    expect(chips(container).returned).toBe("1");
    expect(container.querySelector("a.qa-summary__open")).toBeNull();
    act(() => {
      container.querySelector<HTMLButtonElement>("button.qa-summary__open")!.click();
    });
    expect(onOpenChecklists).toHaveBeenCalledTimes(1);
  });

  it("stays out of the way when there is nothing to count", async () => {
    runs.myItems.mockResolvedValue({ returned: [], developerItems: [] } as never);
    const container = await render();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(container.innerHTML).toBe("");
  });

  it("reads nothing while disabled", async () => {
    const container = await render({ enabled: false });
    expect(container.innerHTML).toBe("");
    expect(runs.myItems).not.toHaveBeenCalled();
    expect(projectRuns.myItems).not.toHaveBeenCalled();
  });

  it("scrolls to and focuses its heading for a ?focus=my-qa-items deep link", async () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    runs.myItems.mockResolvedValue({ returned: [entry(0, "returned_to_dev")], developerItems: [] } as never);
    const container = await render({ highlightRequested: true });
    await poll(() => scrollIntoView.mock.calls.length > 0);
    expect(document.activeElement?.id).toBe("qa-summary-title");
    expect(container.querySelector(".qa-mine--focused")).not.toBeNull();
  });

  it("offers a retry when the list cannot be read", async () => {
    runs.myItems.mockRejectedValue(new Error("boom"));
    const container = await render();
    await poll(() => container.querySelector("[role='alert']") !== null);
    expect([...container.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Try again"]);
  });
});

/* The Checklists tab of a repository in a Project mounts the full card with
 * projectListElsewhere: the Project page owns the list, unless the server
 * has none (then the per-repository card stands in). */
describe("MyQaItemsCard with the Project list elsewhere", () => {
  async function renderCard(): Promise<HTMLElement> {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <MyQaItemsCard projectId="p1" enabled appRole="member" qaScope={PROJECT_SCOPE} projectListElsewhere />,
      );
    });
    return container;
  }

  it("draws nothing while the Project has its own list", async () => {
    projectRuns.myItems.mockResolvedValue({ returned: feed(1), inProgress: [], todo: [], readyForQa: [] } as never);
    const container = await renderCard();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(container.innerHTML).toBe("");
    expect(runs.myItems).not.toHaveBeenCalled();
  });

  it("shows the per-repository card when the server has no Project list", async () => {
    projectRuns.myItems.mockRejectedValue(Object.assign(new Error("Not found"), { status: 404 }));
    runs.myItems.mockResolvedValue({ returned: [entry(0, "returned_to_dev")], developerItems: [] } as never);
    const container = await renderCard();
    await poll(() => container.querySelector("#qa-mine-title") !== null);
    expect(container.querySelector("li.qa-returned__row")).not.toBeNull();
  });
});
