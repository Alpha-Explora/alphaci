import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { checklistsRepository } from "../../../../../src/features/checklists/data/checklists-repository";
import { qaRunsRepository } from "../../../../../src/features/checklists/data/qa-runs-repository";
import { projectsRepository } from "../../../../../src/features/projects/data/projects-repository";
import { QaStudioPanel } from "../../../../../src/features/checklists/studio/views/qa-studio-panel";
import { ReturnedByQaCard } from "../../../../../src/features/checklists/returned/views/returned-by-qa-card";
import { ProjectDetailTopTabs } from "../../../../../src/features/projects/detail/views/project-detail-top-tabs";
import { projectDetailTabGroups } from "../../../../../src/features/projects/detail/views/project-detail-tab-config";
import { visibleProjectDetailTabs } from "../../../../../src/features/projects/detail/model/project-detail-tab-rules";
import type { QaRun } from "../../../../../src/features/checklists/model/qa-run-types";
import type { AppRole, ProjectBranchPreview } from "../../../../../src/shared/api/contracts";
import { checklist } from "../checklist-fixtures";
import { runAs, runItem } from "../qa-run-fixtures";

jest.mock("../../../../../src/features/checklists/data/checklists-repository", () => ({
  checklistsRepository: { listForProject: jest.fn() },
}));
jest.mock("../../../../../src/features/checklists/data/qa-runs-repository", () => ({
  qaRunsRepository: {
    current: jest.fn(),
    create: jest.fn(),
    updateItem: jest.fn(),
    requestRetest: jest.fn(),
    signoff: jest.fn(),
    reopen: jest.fn(),
    returnedItems: jest.fn(),
  },
}));
jest.mock("../../../../../src/features/projects/data/projects-repository", () => ({
  projectsRepository: { previews: jest.fn() },
}));

const checklists = checklistsRepository as jest.Mocked<typeof checklistsRepository>;
const runs = qaRunsRepository as jest.Mocked<typeof qaRunsRepository>;
const projects = projectsRepository as jest.Mocked<typeof projectsRepository>;

function preview(overrides: Partial<ProjectBranchPreview> = {}): ProjectBranchPreview {
  return {
    branch: "main",
    isProduction: true,
    deploymentId: "d1",
    targetId: "web",
    targetName: "storefront-web",
    provider: "vercel",
    status: "ready",
    commitSha: "abc1234",
    commitMessage: null,
    pullRequestNumber: null,
    previewUrl: "https://shop.example.com",
    inspectorUrl: null,
    createdAt: null,
    readyAt: null,
    embeddable: true,
    embedBlockedReason: null,
    surface: "page",
    ...overrides,
  };
}

const ITEMS = [
  runItem(0, { title: "Checkout works", targetPersona: "qa" }),
  runItem(1, { title: "Totals add up", targetPersona: "developer" }),
  runItem(2, {
    title: "Rejects expired sessions",
    targetPersona: "developer",
    status: "returned_to_dev",
    defectSeverity: "blocker",
    notes: "Still returns 201",
  }),
];

function setup(options: {
  run: QaRun | null;
  previews?: ProjectBranchPreview[];
  commitSource?: "deployment" | "branch_head";
}) {
  projects.previews.mockResolvedValue({
    enabled: true,
    liveProvidersEnabled: true,
    providerError: null,
    branches: options.previews ?? [preview()],
  });
  checklists.listForProject.mockResolvedValue({ items: [checklist()], canManage: false });
  runs.current.mockResolvedValue({
    commitSha: "abc1234def",
    commitSource: options.commitSource ?? "deployment",
    run: options.run,
  });
}

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

async function render(node: React.ReactNode): Promise<HTMLElement> {
  if (root) act(() => root?.unmount());
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(node);
  });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  return container;
}

function studio(role: AppRole) {
  return render(<QaStudioPanel projectId="project-1" appRole={role} />);
}

function buttonNamed(container: HTMLElement, name: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(name),
  );
}

function statusSelect(container: HTMLElement, index: number): HTMLSelectElement | null {
  const label = [...container.querySelectorAll("label.qa-status-select")].find((node) =>
    node.textContent?.includes(`Status of item ${index}`),
  );
  return label?.querySelector("select") ?? null;
}

describe("QaStudioPanel", () => {
  it("frames an embeddable preview with the shared sandbox and shows the commit under test", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    const frame = container.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe("https://shop.example.com/");
    expect(frame?.getAttribute("sandbox")).toBe(
      "allow-scripts allow-forms allow-popups allow-same-origin",
    );
    expect(frame?.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(container.textContent).toContain("main @ abc1234");
    expect(container.textContent).toContain("deployed");
    expect(runs.current).toHaveBeenCalledWith("project-1", { branch: "main", checklistId: "cl-1" });
  });

  it("explains a preview that cannot be framed and warns when testing the branch head", async () => {
    setup({
      run: null,
      commitSource: "branch_head",
      previews: [preview({ embeddable: false, embedBlockedReason: "Sends X-Frame-Options: DENY." })],
    });
    const container = await studio("qa");
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.textContent).toContain("Sends X-Frame-Options: DENY.");
    expect(container.querySelector('a[href="https://shop.example.com/"]')).not.toBeNull();
    expect(container.textContent).toContain("not deployed — testing the branch head");
  });

  it("rejects a route on another host and keeps the frame where it was", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    const input = container.querySelector<HTMLInputElement>(".qa-route__input")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(input, "https://evil.example.com/x");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      input.form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(container.textContent).toContain("Stay on shop.example.com");
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe("https://shop.example.com/");
  });

  it("lets QA Team update qa items but not developer items", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    const qaSelect = statusSelect(container, 1);
    expect(qaSelect).not.toBeNull();
    expect([...qaSelect!.options].map((option) => option.value)).toContain("returned_to_dev");
    expect(statusSelect(container, 2)).toBeNull();
    expect(container.textContent).toContain("Read-only for your role");
    expect(buttonNamed(container, "Mark fixed")).toBeUndefined();
    expect(buttonNamed(container, "Sign off")).toBeDefined();
  });

  it("lets a Developer update developer items and request a re-test, but never sign off", async () => {
    setup({ run: runAs("member", { items: ITEMS }) });
    runs.requestRetest.mockResolvedValue(runAs("member", { items: ITEMS }));
    const container = await studio("member");
    expect(statusSelect(container, 1)).toBeNull();
    const devSelect = statusSelect(container, 2);
    expect([...devSelect!.options].map((option) => option.value)).not.toContain("returned_to_dev");
    expect(buttonNamed(container, "Sign off")).toBeUndefined();

    await act(async () => buttonNamed(container, "Mark fixed")!.click());
    await act(async () => buttonNamed(container, "Request re-test")!.click());
    expect(runs.requestRetest).toHaveBeenCalledWith("project-1", "run-1", "ri-2", null);
  });

  it("shows a Developer a read-only studio for QA-only work, with no way to start a run", async () => {
    setup({ run: null });
    const container = await studio("member");
    expect(buttonNamed(container, "Start QA run")).toBeUndefined();
    expect(container.textContent).toContain(
      "QA Team members, Team leads and Admins start verification runs.",
    );

    const qaOnly = [runItem(0, { targetPersona: "qa" }), runItem(1, { targetPersona: "qa" })];
    setup({ run: runAs("member", { items: qaOnly }) });
    const again = await studio("member");
    expect(again.querySelectorAll("label.qa-status-select")).toHaveLength(0);
    expect(buttonNamed(again, "Sign off")).toBeUndefined();
  });

  it("offers QA Team to start a run on the resolved commit, sending no sha", async () => {
    setup({ run: null });
    runs.create.mockResolvedValue(runAs("qa", { items: ITEMS }));
    const container = await studio("qa");
    const start = buttonNamed(container, "Start QA run on main @ abc1234");
    expect(start).toBeDefined();
    await act(async () => start!.click());
    expect(runs.create).toHaveBeenCalledWith("project-1", { checklistId: "cl-1", branch: "main" });
    expect(container.textContent).toContain("Checkout works");
  });

  it("asks for a severity before sending Failed", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    const select = statusSelect(container, 1)!;
    await act(async () => {
      select.value = "failed";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(runs.updateItem).not.toHaveBeenCalled();
    await act(async () => buttonNamed(container, "Mark Failed")!.click());
    expect(runs.updateItem).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Choose a severity before marking this item Failed.");
  });

  it("offers Reload run after a stale write", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    runs.updateItem.mockRejectedValue(
      Object.assign(new Error("x"), { status: 409, details: { message: "Stale rowVersion" } }),
    );
    const container = await studio("qa");
    const select = statusSelect(container, 1)!;
    await act(async () => {
      select.value = "passed";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Stale rowVersion");
    const reload = buttonNamed(container, "Reload run");
    expect(reload).toBeDefined();
    await act(async () => reload!.click());
    expect(runs.current).toHaveBeenCalledTimes(2);
  });

  it("shows the signoff dialog with the reasons a verdict is unavailable", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    await act(async () => buttonNamed(container, "Sign off")!.click());
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("3 items are not passed yet.");
    expect(dialog.textContent).toContain("2 items are still pending or in progress.");
    const approved = dialog.querySelector<HTMLInputElement>('input[value="APPROVED"]')!;
    expect(approved.disabled).toBe(true);
    expect(dialog.querySelector<HTMLInputElement>('input[value="REJECTED"]')!.checked).toBe(true);
  });

  it("makes a signed-off run read-only, with Reopen only for those allowed", async () => {
    const signoff = {
      id: "so-1",
      verdict: "APPROVED" as const,
      summary: "All good",
      conditions: null,
      signedBy: { id: "u", login: "lee" },
      signedAt: "2026-09-25T00:00:00.000Z",
    };
    setup({ run: runAs("lead", { items: ITEMS, status: "signed_off", signoff }) });
    const container = await studio("lead");
    expect(container.textContent).toContain("Signed off");
    expect(container.textContent).toContain("Approved");
    expect(container.querySelectorAll("label.qa-status-select")).toHaveLength(0);
    expect(buttonNamed(container, "Sign off")).toBeUndefined();
    expect(buttonNamed(container, "Mark fixed")).toBeUndefined();
    expect(buttonNamed(container, "Reopen run")).toBeDefined();

    setup({ run: runAs("qa", { items: ITEMS, status: "signed_off", signoff }) });
    const qa = await studio("qa");
    expect(buttonNamed(qa, "Reopen run")).toBeUndefined();
  });
});

describe("ReturnedByQaCard", () => {
  const returned = {
    runId: "run-1",
    branch: "main",
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

  it("renders nothing when nothing was returned", async () => {
    runs.returnedItems.mockResolvedValue({ items: [] });
    const container = await render(<ReturnedByQaCard projectId="p1" enabled appRole="member" />);
    expect(container.textContent).toBe("");
  });

  // A second return round: an earlier round was marked fixed, QA re-tested and
  // returned it again. The developer must be able to ask for a re-test again.
  it("still offers a re-test on an item QA returned again after an earlier fix", async () => {
    const reReturned = {
      ...returned,
      item: {
        ...returned.item,
        fixRequest: {
          requestedAt: "2026-09-25T01:00:00.000Z",
          requestedBy: { id: "u-dev", login: "miguel" },
          note: "first fix",
        },
      },
    };
    runs.returnedItems.mockResolvedValue({ items: [reReturned] });
    const container = await render(<ReturnedByQaCard projectId="p1" enabled appRole="member" />);
    expect(buttonNamed(container, "Mark fixed")).toBeDefined();
  });

  it("renders nothing and fetches nothing while the capability is off", async () => {
    const container = await render(<ReturnedByQaCard projectId="p1" enabled={false} appRole="member" />);
    expect(container.textContent).toBe("");
    expect(runs.returnedItems).not.toHaveBeenCalled();
  });

  it("lists what QA found and lets a Developer ask for a re-test, then refreshes", async () => {
    runs.returnedItems.mockResolvedValue({ items: [returned] });
    runs.requestRetest.mockResolvedValue(runAs("member"));
    const container = await render(<ReturnedByQaCard projectId="p1" enabled appRole="member" />);
    expect(container.textContent).toContain("Returned by QA");
    expect(container.textContent).toContain("main @ abc1234");
    expect(container.textContent).toContain("Release smoke test");
    expect(container.textContent).toContain("Blocker");
    expect(container.textContent).toContain("Call it with an expired cookie");
    expect(container.textContent).toContain("Returned by @ana");

    await act(async () => buttonNamed(container, "Mark fixed")!.click());
    const note = container.querySelector("textarea")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(note, "Fixed in #218");
      note.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => buttonNamed(container, "Request re-test")!.click());
    expect(runs.requestRetest).toHaveBeenCalledWith("p1", "run-1", "ri-2", "Fixed in #218");
    expect(runs.returnedItems).toHaveBeenCalledTimes(2);
  });

  it("does not offer QA Team the re-test they would be asking of themselves", async () => {
    runs.returnedItems.mockResolvedValue({ items: [returned] });
    const container = await render(<ReturnedByQaCard projectId="p1" enabled appRole="qa" />);
    expect(container.textContent).toContain("Rejects expired sessions");
    expect(buttonNamed(container, "Mark fixed")).toBeUndefined();
  });
});

describe("QA Studio tab", () => {
  it("appears in Delivery only when the capability is on", async () => {
    const on = await render(
      <ProjectDetailTopTabs
        groups={projectDetailTabGroups(visibleProjectDetailTabs("qa", { qaChecklistsEnabled: true }))}
        value="overview"
        onChange={() => undefined}
        label="Project sections"
        idPrefix="project-detail"
      />,
    );
    const tab = on.querySelector("#project-detail-tab-qa");
    expect(tab?.textContent).toBe("QA Studio");
    expect(tab?.previousElementSibling?.textContent).toBe("Environment");
    const off = await render(
      <ProjectDetailTopTabs
        groups={projectDetailTabGroups(visibleProjectDetailTabs("qa", { qaChecklistsEnabled: false }))}
        value="overview"
        onChange={() => undefined}
        label="Project sections"
        idPrefix="project-detail"
      />,
    );
    expect(off.querySelector("#project-detail-tab-qa")).toBeNull();
    expect(off.querySelector("#project-detail-tab-hosting")).not.toBeNull();
  });
});
