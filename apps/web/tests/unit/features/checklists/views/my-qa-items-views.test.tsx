import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { qaRunsRepository } from "../../../../../src/features/checklists/data/qa-runs-repository";
import { MyQaItemsCard } from "../../../../../src/features/checklists/returned/views/my-qa-items-card";
import type { AppRole } from "../../../../../src/shared/api/contracts";
import { apiErrorWith } from "../qa-promotion-fixtures";
import { qaRun, runAs, runItem } from "../qa-run-fixtures";

jest.mock("../../../../../src/features/checklists/data/qa-runs-repository", () => ({
  qaRunsRepository: {
    myItems: jest.fn(),
    returnedItems: jest.fn(),
    requestRetest: jest.fn(),
    updateItem: jest.fn(),
  },
}));

const runs = qaRunsRepository as jest.Mocked<typeof qaRunsRepository>;

const returned = {
  runId: "run-1",
  branch: "uat",
  commitSha: "abc1234def",
  checklistName: "Release smoke test",
  item: runItem(2, {
    title: "Rejects expired sessions",
    status: "returned_to_dev",
    defectSeverity: "blocker",
    notes: "Still returns 201",
    reproductionSteps: "Call it with an expired cookie",
    verifiedBy: { id: "u-qa", login: "ana" },
  }),
};

const developerItem = {
  runId: "run-1",
  branch: "uat",
  commitSha: "abc1234def",
  checklistName: "Release smoke test",
  item: runItem(3, {
    title: "Cart total unit tests pass",
    targetPersona: "developer",
    verificationType: "unit_test",
    testIdentifier: "src/cart/cart-total.test.ts",
    rowVersion: 2,
    canUpdate: true,
  }),
};

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function render(role: AppRole, enabled = true): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<MyQaItemsCard projectId="p1" enabled={enabled} appRole={role} />);
  });
  await settle();
  return container;
}

function buttonNamed(container: HTMLElement, name: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((button) => button.textContent?.includes(name));
}

function statusSelect(container: HTMLElement, title: string): HTMLSelectElement {
  const label = [...container.querySelectorAll("label.qa-mine__status")].find((node) =>
    node.textContent?.includes(`Status of ${title}`),
  );
  if (!label) throw new Error(`no status control for ${title}`);
  return label.querySelector("select")!;
}

async function choose(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
}

describe("MyQaItemsCard", () => {
  it("renders nothing when both lists are empty, and fetches nothing while the capability is off", async () => {
    runs.myItems.mockResolvedValue({ returned: [], developerItems: [] });
    const empty = await render("member");
    expect(empty.textContent).toBe("");
    const off = await render("member", false);
    expect(off.textContent).toBe("");
    expect(runs.myItems).toHaveBeenCalledTimes(1);
  });

  it("renders nothing for a reply with neither list (an older or partial backend)", async () => {
    runs.myItems.mockResolvedValue({});
    const container = await render("member");
    expect(container.textContent).toBe("");
  });

  it("section 1 keeps the Returned by QA behaviour: what QA found, and a re-test request that refreshes", async () => {
    runs.myItems.mockResolvedValue({ returned: [returned], developerItems: [] });
    runs.requestRetest.mockResolvedValue(runAs("member"));
    const container = await render("member");
    expect(container.textContent).toContain("My QA items");
    expect(container.textContent).toContain("Returned by QA");
    expect(container.textContent).toContain("uat @ abc1234");
    expect(container.textContent).toContain("Blocker");
    expect(container.textContent).toContain("Call it with an expired cookie");
    expect(container.textContent).toContain("Returned by @ana");
    expect(container.textContent).not.toContain("Your checks on");
    await act(async () => buttonNamed(container, "Mark fixed")!.click());
    await act(async () => buttonNamed(container, "Request re-test")!.click());
    await settle();
    expect(runs.requestRetest).toHaveBeenCalledWith("p1", "run-1", "ri-2", null);
    expect(runs.myItems).toHaveBeenCalledTimes(2);
  });

  it("does not offer QA Team the re-test they would be asking of themselves", async () => {
    runs.myItems.mockResolvedValue({ returned: [returned], developerItems: [] });
    const container = await render("qa");
    expect(container.textContent).toContain("Rejects expired sessions");
    expect(buttonNamed(container, "Mark fixed")).toBeUndefined();
  });

  it("section 2 lists the developer items on uat @ sha7 with the studio's status control — never Returned to dev", async () => {
    runs.myItems.mockResolvedValue({ returned: [], developerItems: [developerItem] });
    const container = await render("member");
    expect(container.querySelector("h3")?.textContent).toContain("Your checks on uat @ abc1234");
    expect(container.textContent).toContain("Cart total unit tests pass");
    expect(container.textContent).toContain("src/cart/cart-total.test.ts");
    const select = statusSelect(container, "Cart total unit tests pass");
    const options = [...select.options].map((option) => option.value);
    expect(options).toEqual(["pending", "in_progress", "passed", "failed", "blocked"]);
    expect(options).not.toContain("returned_to_dev");
  });

  it("saves a plain status with the row version read and shows the server's answer at once", async () => {
    runs.myItems.mockResolvedValue({ returned: [], developerItems: [developerItem] });
    runs.updateItem.mockResolvedValue(
      qaRun({ items: [runItem(3, { title: "Cart total unit tests pass", status: "passed", rowVersion: 3, canUpdate: true, verifiedBy: { id: "u-dev", login: "miguel" } })] }),
    );
    const container = await render("member");
    await choose(statusSelect(container, "Cart total unit tests pass"), "passed");
    expect(runs.updateItem).toHaveBeenCalledWith("p1", "run-1", "ri-3", { expectedRowVersion: 2, status: "passed" });
    expect(container.querySelector(".qa-mine__row .qa-pill")?.textContent).toContain("Passed");
    expect(container.textContent).toContain("Passed by @miguel");
    expect(runs.myItems).toHaveBeenCalledTimes(1);
  });

  it("Failed needs a severity before anything is sent", async () => {
    runs.myItems.mockResolvedValue({ returned: [], developerItems: [developerItem] });
    runs.updateItem.mockResolvedValue(qaRun({ items: [runItem(3, { status: "failed", rowVersion: 3 })] }));
    const container = await render("member");
    await choose(statusSelect(container, "Cart total unit tests pass"), "failed");
    const form = container.querySelector("form.qa-mine__editor")!;
    expect(form).not.toBeNull();
    await act(async () => buttonNamed(container, "Mark Failed")!.click());
    expect(form.querySelector('[role="alert"]')?.textContent).toBe("Choose a severity before marking this item Failed.");
    expect(runs.updateItem).not.toHaveBeenCalled();
    const severity = form.querySelector<HTMLSelectElement>("select")!;
    await choose(severity, "major");
    await act(async () => buttonNamed(container, "Mark Failed")!.click());
    await settle();
    expect(runs.updateItem).toHaveBeenCalledWith("p1", "run-1", "ri-3", {
      expectedRowVersion: 2,
      status: "failed",
      defectSeverity: "major",
    });
  });

  it("a stale 409 offers a reload of the card", async () => {
    runs.myItems.mockResolvedValue({ returned: [], developerItems: [developerItem] });
    runs.updateItem.mockRejectedValue(apiErrorWith(409, { code: "QA_ITEM_STALE", message: "This item has changed; reload and try again." }));
    const container = await render("member");
    await choose(statusSelect(container, "Cart total unit tests pass"), "passed");
    expect(container.querySelector(".qa-mine__alert")?.textContent).toContain("This item has changed");
    await act(async () => buttonNamed(container, "Reload items")!.click());
    await settle();
    expect(runs.myItems).toHaveBeenCalledTimes(2);
    expect(container.querySelector(".qa-mine__alert")).toBeNull();
  });

  it("an item the server does not give this viewer is read-only", async () => {
    runs.myItems.mockResolvedValue({ returned: [], developerItems: [{ ...developerItem, item: { ...developerItem.item, canUpdate: false } }] });
    const container = await render("qa");
    expect(container.querySelector("label.qa-mine__status")).toBeNull();
    expect(container.textContent).toContain("Read-only for your role");
  });

  it("falls back to qa-returned-items on an older backend", async () => {
    runs.myItems.mockRejectedValue(apiErrorWith(404));
    runs.returnedItems.mockResolvedValue({ items: [returned] });
    const container = await render("member");
    expect(container.textContent).toContain("Rejects expired sessions");
    expect(container.querySelector(".qa-returned-error")).toBeNull();
  });

  it("shows a retry when the read fails", async () => {
    runs.myItems.mockRejectedValue(apiErrorWith(500));
    const container = await render("member");
    expect(container.textContent).toContain("Your QA items could not be loaded.");
    runs.myItems.mockResolvedValue({ returned: [returned], developerItems: [] });
    await act(async () => buttonNamed(container, "Try again")!.click());
    await settle();
    expect(container.textContent).toContain("Rejects expired sessions");
  });
});
