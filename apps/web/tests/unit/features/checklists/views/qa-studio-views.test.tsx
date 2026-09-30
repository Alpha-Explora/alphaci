import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { checklistsRepository } from "../../../../../src/features/checklists/data/checklists-repository";
import { qaRunsRepository } from "../../../../../src/features/checklists/data/qa-runs-repository";
import { projectsRepository } from "../../../../../src/features/projects/data/projects-repository";
import { QaStudioPanel } from "../../../../../src/features/checklists/studio/views/qa-studio-panel";
import { ProjectDetailTopTabs } from "../../../../../src/features/projects/detail/views/project-detail-top-tabs";
import { projectDetailTabGroups } from "../../../../../src/features/projects/detail/views/project-detail-tab-config";
import { visibleProjectDetailTabs } from "../../../../../src/features/projects/detail/model/project-detail-tab-rules";
import type { QaRun } from "../../../../../src/features/checklists/model/qa-run-types";
import type { AppRole, ProjectBranchPreview } from "../../../../../src/shared/api/contracts";
import { checklist } from "../checklist-fixtures";
import { automation } from "../qa-automation-fixtures";
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
    promotion: jest.fn().mockResolvedValue({}),
    mergePromotion: jest.fn(),
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
    branch: "uat",
    isProduction: false,
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
    expect(container.textContent).toContain("uat @ abc1234");
    expect(container.textContent).toContain("deployed");
    expect(runs.current).toHaveBeenCalledWith("project-1", { branch: "uat", checklistId: "cl-1" });
  });

  it.each<AppRole>(["member", "qa", "lead"])(
    "offers Export report in the run header to a %s once a run is loaded",
    async (role) => {
      setup({ run: runAs(role, { items: ITEMS }) });
      const container = await studio(role);
      const head = container.querySelector(".qa-run__head");
      const exportButton = head?.querySelector('button[aria-haspopup="menu"]');
      expect(exportButton?.textContent).toContain("Export report");
    },
  );

  it("offers no export before a run exists", async () => {
    setup({ run: null });
    const container = await studio("qa");
    expect(container.querySelector('button[aria-haspopup="menu"]')).toBeNull();
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
    const start = buttonNamed(container, "Start QA run on uat @ abc1234");
    expect(start).toBeDefined();
    await act(async () => start!.click());
    expect(runs.create).toHaveBeenCalledWith("project-1", { checklistId: "cl-1", branch: "uat" });
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

describe("QA Studio tab", () => {
  it("appears in Delivery only when the capability is on", async () => {
    // "lead", not "qa": Environment is now its own gate (ENV_VARS_LEAD_ONLY),
    // and QA no longer sees it — this test is about the strip's ORDER (QA
    // Studio directly follows Environment for a viewer who gets both), which
    // a Team Lead still exercises. QA's own tab set is covered separately in
    // project-detail-tab-visibility.test.ts.
    const on = await render(
      <ProjectDetailTopTabs
        groups={projectDetailTabGroups(visibleProjectDetailTabs("lead", { qaChecklistsEnabled: true }))}
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
        groups={projectDetailTabGroups(visibleProjectDetailTabs("lead", { qaChecklistsEnabled: false }))}
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

describe("QA Studio — uat only", () => {
  it("offers only the uat deployment when main (production) and uat are both deployed", async () => {
    setup({
      run: runAs("qa", { items: ITEMS }),
      previews: [preview({ branch: "main", isProduction: true, previewUrl: "https://main.example.com" }), preview()],
    });
    const container = await studio("qa");
    expect(container.querySelector(".qa-toolbar__env-chip")?.textContent).toBe("uat");
    // No picker: there is nothing else to pick.
    expect(container.querySelector(".qa-toolbar select")).toBeNull();
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe("https://shop.example.com/");
    expect(runs.current).toHaveBeenCalledTimes(1);
    expect(runs.current).toHaveBeenCalledWith("project-1", { branch: "uat", checklistId: "cl-1" });
  });

  it("shows the no-uat state instead of falling back to main, and asks for no run", async () => {
    setup({ run: null, previews: [preview({ branch: "main", isProduction: true })] });
    const container = await studio("qa");
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector(".qa-toolbar")).toBeNull();
    expect(container.textContent).toContain("No uat deployment yet");
    expect(container.textContent).toContain("QA Studio tests the uat environment");
    expect(container.textContent).toContain("QA runs are recorded against uat.");
    expect(runs.current).not.toHaveBeenCalled();
  });
});

function radioNamed(container: HTMLElement, name: string): HTMLButtonElement {
  const radio = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((node) =>
    node.textContent?.includes(name),
  );
  if (!radio) throw new Error(`no ${name} radio`);
  return radio;
}

function fullScreenButton(container: HTMLElement): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>('button[aria-label="Full screen"]')!;
}

async function click(element: Element | null | undefined) {
  if (!element) throw new Error("nothing to click");
  await act(async () => {
    (element as HTMLElement).click();
  });
}

describe("QA Studio — device viewports and full screen", () => {
  it("never remounts the iframe when switching device, rotating or entering and leaving full screen", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    const frame = container.querySelector("iframe");
    const device = container.querySelector(".qa-device");
    expect(frame).not.toBeNull();
    expect(device?.getAttribute("data-frame")).toBe("browser");

    await click(radioNamed(container, "Tablet"));
    expect(device?.getAttribute("data-frame")).toBe("tablet");
    expect(device?.getAttribute("data-orientation")).toBe("portrait");
    await click(buttonNamed(container, "Rotate"));
    expect(device?.getAttribute("data-orientation")).toBe("landscape");
    await click(radioNamed(container, "Mobile"));
    expect(device?.getAttribute("data-frame")).toBe("phone");
    await click(buttonNamed(container, "Rotate"));
    expect(device?.getAttribute("data-orientation")).toBe("portrait");
    await click(fullScreenButton(container));
    expect(container.querySelector(".qa-studio")?.getAttribute("data-full-screen")).toBe("true");
    await click(fullScreenButton(container));
    expect(container.querySelector(".qa-studio")?.getAttribute("data-full-screen")).toBe("false");
    await click(radioNamed(container, "Desktop"));

    // The same element instances throughout: the site under test was never reloaded.
    expect(container.querySelector("iframe")).toBe(frame);
    expect(container.querySelector(".qa-device")).toBe(device);
    expect(container.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("draws the true viewport: 1440 × 900 on Desktop, swapped sides in landscape", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    const device = container.querySelector<HTMLElement>(".qa-device")!;
    expect(device.style.getPropertyValue("--qa-screen-w")).toBe("1440");
    expect(device.style.getPropertyValue("--qa-screen-h")).toBe("900");
    expect(container.querySelector(".qa-device__size")?.textContent).toBe("1440 × 900");
    expect(container.querySelector(".qa-device__address")?.textContent).toBe("shop.example.com");
    expect(buttonNamed(container, "Rotate")?.disabled).toBe(true);
    await click(radioNamed(container, "Tablet"));
    await click(buttonNamed(container, "Rotate"));
    expect(device.style.getPropertyValue("--qa-screen-w")).toBe("1024");
    expect(device.style.getPropertyValue("--qa-screen-h")).toBe("768");
    expect(container.querySelector(".qa-preview__device")?.textContent).toBe("Tablet · 1024 × 768 · Landscape");
  });

  it("mounts the run column once, floats it in full screen, and keeps it mounted when minimized", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    const studioRoot = container.querySelector(".qa-studio")!;
    const column = container.querySelector(".qa-studio__run");
    const card = container.querySelector(".qa-run-card");
    expect(studioRoot.getAttribute("data-checklist")).toBe("docked");
    expect(container.querySelector(".qa-launcher")).toBeNull();

    await click(fullScreenButton(container));
    expect(document.body.style.overflow).toBe("hidden");
    expect(studioRoot.getAttribute("data-checklist")).toBe("minimized");
    const launcher = container.querySelector<HTMLButtonElement>(".qa-launcher")!;
    expect(launcher.textContent).toContain("QA checklist · 0/3 passed");
    expect(launcher.getAttribute("aria-expanded")).toBe("false");
    expect(launcher.getAttribute("aria-controls")).toBe(column?.id);

    await click(launcher);
    expect(studioRoot.getAttribute("data-checklist")).toBe("open");
    expect(column?.getAttribute("role")).toBe("region");
    const heading = container.querySelector(".qa-drawer__title");
    expect(heading?.textContent).toBe("QA checklist");
    expect(document.activeElement).toBe(heading);

    await click(container.querySelector('button[aria-label="Move to the left side"]'));
    expect(studioRoot.getAttribute("data-side")).toBe("left");

    // Change an item, then minimize: the same column and card stay mounted.
    await click(container.querySelector('button[aria-label="Minimize checklist"]'));
    expect(studioRoot.getAttribute("data-checklist")).toBe("minimized");
    expect(document.activeElement).toBe(container.querySelector(".qa-launcher"));
    expect(container.querySelector(".qa-studio__run")).toBe(column);
    expect(container.querySelector(".qa-run-card")).toBe(card);
    expect(container.querySelectorAll(".qa-run-card")).toHaveLength(1);
    expect(container.querySelectorAll(".qa-run__head")).toHaveLength(1);

    // Dock: back beside the page, the same column again.
    await click(container.querySelector(".qa-launcher"));
    await click(container.querySelector('button[aria-label="Dock beside the page"]'));
    expect(studioRoot.getAttribute("data-full-screen")).toBe("false");
    expect(container.querySelector(".qa-studio__run")).toBe(column);
    expect(container.querySelector(".qa-run-card")).toBe(card);
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(fullScreenButton(container));
  });

  it("opens Sign off from the floating drawer and keeps full screen while its Escape closes it", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    await click(fullScreenButton(container));
    await click(container.querySelector(".qa-launcher"));
    await click(buttonNamed(container, "Sign off"));
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(container.querySelector(".qa-studio")?.getAttribute("data-full-screen")).toBe("true");
  });

  it("says when CI is failing on the launcher's dot", async () => {
    setup({ run: runAs("qa", { items: ITEMS, automation: automation() }) });
    const container = await studio("qa");
    await click(fullScreenButton(container));
    const dot = container.querySelector(".qa-launcher__dot");
    expect(dot?.getAttribute("data-tone")).toBe("failed");
    expect(container.querySelector(".qa-launcher")?.textContent).toContain("Automated tests failed");
  });
});
