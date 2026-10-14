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
  window.localStorage.clear();
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

function resolutionSelect(container: HTMLElement): HTMLSelectElement {
  return container.querySelector<HTMLSelectElement>("select.qa-resolution__select")!;
}

function radio(container: HTMLElement, name: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>('.qa-device-switch [role="radio"]')].find(
    (button) => button.getAttribute("aria-label") === name,
  )!;
}

/** Rotate is an icon: its name says where it turns ("Rotate to landscape"). */
function rotateButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>('button[aria-label^="Rotate to "]');
}

function customInput(container: HTMLElement, label: string): HTMLInputElement {
  return container.querySelector<HTMLInputElement>(`.qa-resolution__custom input[aria-label="${label}"]`)!;
}

async function chooseOption(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function blur(input: HTMLInputElement) {
  await act(async () => {
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}

describe("QaStudioPanel", () => {
  it("frames an embeddable preview with the shared sandbox, always opening the environment root", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    const frame = container.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe("https://shop.example.com/");
    expect(frame?.getAttribute("sandbox")).toBe(
      "allow-scripts allow-forms allow-popups allow-same-origin",
    );
    expect(frame?.getAttribute("referrerpolicy")).toBe("no-referrer");
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

  it("has no address box and one toolbar row, with the frame's actions on its right in order", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    expect(container.querySelector(".qa-route")).toBeNull();
    expect(container.querySelector(".qa-toolbar__row--address")).toBeNull();
    expect(container.querySelector('[aria-label="Go to route"]')).toBeNull();
    expect(container.querySelector('[role="search"]')).toBeNull();
    expect(container.querySelectorAll(".qa-toolbar__row")).toHaveLength(1);
    expect(container.querySelector(".qa-toolbar input")).toBeNull();

    const row = container.querySelector(".qa-toolbar__row")!;
    const actions = [...row.querySelectorAll(".qa-toolbar__actions button, .qa-toolbar__actions a")].map((node) =>
      node.getAttribute("aria-label"),
    );
    expect(actions).toEqual([
      "Reload preview",
      "Copy link",
      "Open in new tab",
      "Wide preview",
      "Split",
      "Full screen",
    ]);
    // The actions close the row: nothing follows them.
    expect(row.lastElementChild).toBe(row.querySelector(".qa-toolbar__actions"));
  });

  it("drops the commit chip and says nothing about a deployed commit", async () => {
    setup({ run: runAs("qa", { items: ITEMS }), commitSource: "deployment" });
    const container = await studio("qa");
    expect(container.querySelector('[aria-label="Commit under test"]')).toBeNull();
    expect(container.querySelector(".qa-commit")).toBeNull();
    expect(container.querySelector(".qa-commit-warning")).toBeNull();
  });

  it("keeps the warning when the commit under test is the branch head, and only then", async () => {
    setup({ run: runAs("qa", { items: ITEMS }), commitSource: "branch_head" });
    const container = await studio("qa");
    const warning = container.querySelector(".qa-toolbar .qa-commit-warning");
    expect(warning?.textContent).toBe("not deployed — testing the branch head");
    expect(warning?.querySelector("svg")).not.toBeNull();
    expect(container.querySelector(".qa-toolbar__row")?.contains(warning)).toBe(true);
  });

  it("offers each class's resolutions and changes the frame's size without re-mounting it", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    const frame = container.querySelector("iframe")!;
    const caption = () => container.querySelector(".qa-preview__device")?.textContent;
    const screenWidth = () =>
      container.querySelector<HTMLElement>(".qa-device")?.style.getPropertyValue("--qa-screen-w");

    const desktop = resolutionSelect(container);
    expect([...desktop.options].map((option) => option.value)).toEqual([
      "1280x720",
      "1366x768",
      "1440x900",
      "1536x864",
      "1920x1080",
      "2560x1440",
      "custom",
    ]);
    expect(desktop.value).toBe("1440x900");
    expect(desktop.selectedOptions[0].textContent).toBe("1440 × 900");
    expect(caption()).toBe("Desktop · 1440 × 900");
    expect(container.querySelector(".qa-device-switch__px")).toBeNull();

    await chooseOption(desktop, "1920x1080");
    expect(resolutionSelect(container).value).toBe("1920x1080");
    expect(caption()).toBe("Desktop · 1920 × 1080");
    expect(screenWidth()).toBe("1920");
    expect(container.querySelector("iframe")).toBe(frame);
    expect(frame.getAttribute("src")).toBe("https://shop.example.com/");

    await act(async () => radio(container, "Mobile").click());
    const mobile = resolutionSelect(container);
    expect([...mobile.options].map((option) => option.textContent)).toEqual([
      "360 × 800 · Android",
      "375 × 667 · iPhone SE",
      "375 × 812 · iPhone X/11 Pro",
      "390 × 844 · iPhone 14",
      "393 × 852 · iPhone 15",
      "412 × 915 · Pixel",
      "430 × 932 · iPhone Pro Max",
      "Custom…",
    ]);
    expect(mobile.value).toBe("375x812");
    await chooseOption(mobile, "390x844");
    expect(caption()).toBe("Mobile · 390 × 844 · Portrait");
    const rotate = container.querySelector<HTMLButtonElement>("button.qa-rotate")!;
    await act(async () => rotate.click());
    expect(caption()).toBe("Mobile · 844 × 390 · Landscape");
    expect(container.querySelector("iframe")).toBe(frame);

    await act(async () => radio(container, "Desktop").click());
    expect(caption()).toBe("Desktop · 1920 × 1080");
  });

  it("validates a custom size, applies it on Enter or blur, and keeps the last valid size meanwhile", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    const frame = container.querySelector("iframe")!;
    const caption = () => container.querySelector(".qa-preview__device")?.textContent;
    expect(container.querySelector(".qa-resolution__custom")).toBeNull();

    await chooseOption(resolutionSelect(container), "custom");
    expect(resolutionSelect(container).value).toBe("custom");
    const [width, height] = [customInput(container, "Width in pixels"), customInput(container, "Height in pixels")];
    expect([width.value, height.value]).toEqual(["1440", "900"]);
    expect(caption()).toBe("Desktop · 1440 × 900");

    await typeInto(width, "100");
    await act(async () => {
      width.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    expect(container.querySelector(".qa-resolution__error")?.textContent).toBe(
      "Width must be a whole number from 320 to 3840.",
    );
    expect(width.getAttribute("aria-invalid")).toBe("true");
    expect(caption()).toBe("Desktop · 1440 × 900");

    await typeInto(width, "1500");
    await typeInto(height, "2500");
    await blur(height);
    expect(container.querySelector(".qa-resolution__error")?.textContent).toBe(
      "Height must be a whole number from 320 to 2400.",
    );
    expect(caption()).toBe("Desktop · 1440 × 900");

    await typeInto(height, "900");
    await act(async () => {
      height.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    expect(container.querySelector(".qa-resolution__error")).toBeNull();
    expect(caption()).toBe("Desktop · 1500 × 900");

    await typeInto(width, "3000");
    await blur(width);
    expect(caption()).toBe("Desktop · 3000 × 900");
    expect(container.querySelector("iframe")).toBe(frame);

    // Back to a preset: the typed fields go away.
    await chooseOption(resolutionSelect(container), "1280x720");
    expect(container.querySelector(".qa-resolution__custom")).toBeNull();
    expect(caption()).toBe("Desktop · 1280 × 720");
  });

  describe("Copy link", () => {
    const writeText = jest.fn();

    beforeEach(() => {
      writeText.mockReset();
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    });

    afterEach(() => {
      Reflect.deleteProperty(navigator, "clipboard");
    });

    const copyButton = (container: HTMLElement) =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Copy link"]')!;
    const liveRegion = (container: HTMLElement) =>
      container.querySelector(".qa-toolbar__actions [role='status']")!;

    it("copies the environment's page url and says so, politely", async () => {
      writeText.mockResolvedValue(undefined);
      setup({ run: runAs("qa", { items: ITEMS }) });
      const container = await studio("qa");
      const button = copyButton(container);
      expect(button.title).toBe("Copy link to share");
      expect(button.disabled).toBe(false);
      expect(liveRegion(container).textContent).toBe("");

      await act(async () => button.click());
      expect(writeText).toHaveBeenCalledWith("https://shop.example.com/");
      expect(liveRegion(container).textContent).toBe("Copied");
      expect(copyButton(container).title).toBe("Copied");
      expect(copyButton(container).dataset.status).toBe("copied");
    });

    it("says when the copy was refused, rather than looking as if it worked", async () => {
      writeText.mockRejectedValue(new Error("denied"));
      setup({ run: runAs("qa", { items: ITEMS }) });
      const container = await studio("qa");
      await act(async () => copyButton(container).click());
      expect(liveRegion(container).textContent).toBe("Couldn't copy");
      expect(copyButton(container).dataset.status).toBe("failed");
    });

    it("is disabled when the environment has no page address", async () => {
      setup({ run: null, previews: [preview({ previewUrl: null, embeddable: false })] });
      const container = await studio("qa");
      const button = copyButton(container);
      expect(button.disabled).toBe(true);
      await act(async () => button.click());
      expect(writeText).not.toHaveBeenCalled();
    });
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
      "QA Team members, Product owners and admins start verification runs.",
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
    // An Admin, not "qa": this test is about the strip's ORDER (QA Studio
    // directly follows Hosting, which holds the old Environment tab's
    // variables, for a viewer who gets both). QA's own tab set is covered separately in
    // project-detail-tab-visibility.test.ts.
    const on = await render(
      <ProjectDetailTopTabs
        groups={projectDetailTabGroups(visibleProjectDetailTabs("admin", { qaChecklistsEnabled: true }))}
        value="overview"
        onChange={() => undefined}
        label="Project sections"
        idPrefix="project-detail"
      />,
    );
    const tab = on.querySelector("#project-detail-tab-qa");
    expect(tab?.textContent).toBe("QA Studio");
    expect(tab?.previousElementSibling?.textContent).toBe("Hosting");
    const off = await render(
      <ProjectDetailTopTabs
        groups={projectDetailTabGroups(visibleProjectDetailTabs("admin", { qaChecklistsEnabled: false }))}
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
    // Neither a chip nor a label: the studio previews uat only, so there is nothing to name or pick.
    expect(container.querySelector(".qa-toolbar__env")).toBeNull();
    expect(container.querySelector(".qa-toolbar .qa-toolbar__label")).toBeNull();
    expect(container.querySelector(".qa-toolbar")?.textContent).not.toContain("Environment");
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
  const radio = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(
    (node) => node.getAttribute("aria-label") === name,
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
    await click(rotateButton(container));
    expect(device?.getAttribute("data-orientation")).toBe("landscape");
    await click(radioNamed(container, "Mobile"));
    expect(device?.getAttribute("data-frame")).toBe("phone");
    await click(rotateButton(container));
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
    // Desktop does not turn, so it has no Rotate at all rather than a disabled one.
    expect(rotateButton(container)).toBeNull();
    await click(radioNamed(container, "Tablet"));
    await click(rotateButton(container));
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

function layoutButton(container: HTMLElement, name: "Wide preview" | "Split"): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>(`.qa-layout-switch button[aria-label="${name}"]`);
}

/** jsdom has no ResizeObserver: a stand-in that records what it watches and can report a new size. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(element: Element) {
    this.observed.push(element);
  }

  unobserve() {}

  disconnect() {
    this.disconnected = true;
  }

  resize(width: number, height: number) {
    const entry = { contentRect: { width, height } } as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }
}

describe("QA Studio — layouts", () => {
  afterEach(() => {
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    FakeResizeObserver.instances = [];
  });

  it("opens on wide preview and switches to split without remounting the frame or the run column", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    const studioRoot = container.querySelector(".qa-studio")!;
    const frame = container.querySelector("iframe");
    const column = container.querySelector(".qa-studio__run");
    const card = container.querySelector(".qa-run-card");
    expect(frame).not.toBeNull();
    expect(studioRoot.getAttribute("data-layout")).toBe("wide");
    expect(container.querySelector(".qa-layout-switch legend")?.textContent).toBe("Layout");
    expect(layoutButton(container, "Wide preview")?.getAttribute("aria-pressed")).toBe("true");
    expect(layoutButton(container, "Split")?.getAttribute("aria-pressed")).toBe("false");

    await click(layoutButton(container, "Split"));
    expect(studioRoot.getAttribute("data-layout")).toBe("split");
    expect(layoutButton(container, "Split")?.getAttribute("aria-pressed")).toBe("true");
    expect(layoutButton(container, "Wide preview")?.getAttribute("aria-pressed")).toBe("false");
    expect(window.localStorage.getItem("alphaci.qa-studio.layout")).toBe("split");

    await click(layoutButton(container, "Wide preview"));
    expect(studioRoot.getAttribute("data-layout")).toBe("wide");

    // Only the attribute changed: the site under test and the run's drafts were never touched.
    expect(container.querySelector("iframe")).toBe(frame);
    expect(container.querySelectorAll("iframe")).toHaveLength(1);
    expect(container.querySelector(".qa-studio__run")).toBe(column);
    expect(container.querySelector(".qa-run-card")).toBe(card);
  });

  it("opens on the layout this viewer chose last time", async () => {
    window.localStorage.setItem("alphaci.qa-studio.layout", "split");
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    expect(container.querySelector(".qa-studio")?.getAttribute("data-layout")).toBe("split");
    expect(layoutButton(container, "Split")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("hides the layout switch in full screen and brings it back, choice kept, when docked again", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    await click(layoutButton(container, "Split"));
    await click(fullScreenButton(container));
    expect(container.querySelector(".qa-layout-switch")).toBeNull();
    await click(fullScreenButton(container));
    expect(container.querySelector(".qa-layout-switch")).not.toBeNull();
    expect(container.querySelector(".qa-studio")?.getAttribute("data-layout")).toBe("split");
  });

  it("refits the device when a layout change resizes the stage, watching the same stage throughout", async () => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    const stage = container.querySelector(".qa-stage")!;
    const device = container.querySelector<HTMLElement>(".qa-device")!;
    const observer = FakeResizeObserver.instances.find((instance) => instance.observed.includes(stage))!;
    expect(observer).toBeDefined();

    // Wide: a 1000px stage draws the 1440px desktop at (1000 - 0) / 1440.
    await act(async () => observer.resize(1000, 800));
    const wideScale = Number(device.style.getPropertyValue("--qa-scale"));
    expect(wideScale).toBeCloseTo(1000 / 1440, 5);

    // Split narrows the column; CSS resizes the stage and the observer reports it.
    await click(layoutButton(container, "Split"));
    expect(observer.disconnected).toBe(false);
    expect(container.querySelector(".qa-stage")).toBe(stage);
    await act(async () => observer.resize(700, 800));
    expect(Number(device.style.getPropertyValue("--qa-scale"))).toBeCloseTo(700 / 1440, 5);
    expect(container.querySelector(".qa-preview__scale")?.textContent).toBe("Scaled to 49%");
  });
});

describe("QA Studio — compact controls", () => {
  it("draws the device classes as named icons and offers Rotate only for the ones that turn", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    for (const name of ["Desktop", "Tablet", "Mobile"]) {
      const option = radio(container, name);
      expect(option.getAttribute("title")).toBe(name);
      expect(option.textContent).toBe("");
      expect(option.querySelector("svg")).not.toBeNull();
    }
    expect(rotateButton(container)).toBeNull();

    await click(radio(container, "Tablet"));
    expect(rotateButton(container)?.getAttribute("title")).toBe("Rotate to landscape");
    await click(rotateButton(container));
    expect(rotateButton(container)?.getAttribute("aria-label")).toBe("Rotate to portrait");
    await click(radio(container, "Mobile"));
    expect(rotateButton(container)).not.toBeNull();
    await click(radio(container, "Desktop"));
    expect(rotateButton(container)).toBeNull();
  });

  it("shows the width and height fields only while Custom… is chosen", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const container = await studio("qa");
    expect(container.querySelector(".qa-toolbar input")).toBeNull();
    await chooseOption(resolutionSelect(container), "custom");
    expect(container.querySelectorAll(".qa-toolbar input[type='number']")).toHaveLength(2);
    await chooseOption(resolutionSelect(container), "1920x1080");
    expect(container.querySelector(".qa-toolbar input")).toBeNull();
  });

  it("keeps a picker, unlabelled but named, only when two targets deploy uat", async () => {
    setup({
      run: runAs("qa", { items: ITEMS }),
      previews: [preview(), preview({ targetId: "admin", targetName: "admin-web", previewUrl: "https://admin.example.com" })],
    });
    const container = await studio("qa");
    const picker = container.querySelector<HTMLSelectElement>("select.qa-toolbar__env")!;
    expect(picker.getAttribute("aria-label")).toBe("Environment");
    expect([...picker.options].map((option) => option.textContent)).toEqual([
      "uat · storefront-web",
      "uat · admin-web",
    ]);
    expect(container.querySelector(".qa-toolbar .qa-toolbar__label")).toBeNull();
    await chooseOption(picker, "admin:uat");
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe("https://admin.example.com/");
  });
});

/** A stand-in for the project page's tab row: the element the studio portals its toolbar into. */
function tabRowSlot(): HTMLElement {
  const slot = document.createElement("div");
  slot.className = "project-studio-controls";
  document.body.appendChild(slot);
  return slot;
}

describe("QA Studio — controls in the tab row", () => {
  it("renders the toolbar in the tab row's slot, borderless, and none inside the studio", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const slot = tabRowSlot();
    const container = await render(<QaStudioPanel projectId="project-1" appRole="qa" toolbarSlot={slot} />);
    const toolbar = slot.querySelector(".qa-toolbar");
    expect(toolbar?.getAttribute("data-placement")).toBe("tab-row");
    expect(toolbar?.getAttribute("aria-label")).toBe("Preview controls");
    expect(container.querySelector(".qa-toolbar")).toBeNull();
    expect(document.querySelectorAll(".qa-toolbar")).toHaveLength(1);
  });

  it("drives the one preview from the tab row: the same ViewModel, never a copy", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const slot = tabRowSlot();
    const container = await render(<QaStudioPanel projectId="project-1" appRole="qa" toolbarSlot={slot} />);
    const device = container.querySelector(".qa-device")!;
    const frame = container.querySelector("iframe");

    await click(radio(slot, "Tablet"));
    expect(device.getAttribute("data-frame")).toBe("tablet");
    await click(rotateButton(slot));
    expect(device.getAttribute("data-orientation")).toBe("landscape");
    await chooseOption(resolutionSelect(slot), "820x1180");
    expect(container.querySelector(".qa-preview__device")?.textContent).toBe("Tablet · 1180 × 820 · Landscape");
    await click(slot.querySelector('button[aria-label="Split"]'));
    expect(container.querySelector(".qa-studio")?.getAttribute("data-layout")).toBe("split");
    expect(container.querySelector("iframe")).toBe(frame);
  });

  it("brings the controls inside the studio in full screen, and focus with them, then back", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    const slot = tabRowSlot();
    const container = await render(<QaStudioPanel projectId="project-1" appRole="qa" toolbarSlot={slot} />);
    const studioRoot = container.querySelector(".qa-studio")!;
    const toggle = fullScreenButton(slot);
    toggle.focus();

    await click(toggle);
    expect(studioRoot.getAttribute("data-full-screen")).toBe("true");
    expect(slot.childElementCount).toBe(0);
    const bar = studioRoot.querySelector(".qa-toolbar");
    expect(bar?.getAttribute("data-placement")).toBe("studio");
    expect(studioRoot.firstElementChild).toBe(bar);
    // The pressed toggle went with the tab row; its twin in the bar has focus.
    expect(document.activeElement).toBe(fullScreenButton(container));
    expect(fullScreenButton(container).getAttribute("aria-pressed")).toBe("true");

    // The device chosen in the tab row is still the device here: one ViewModel.
    await click(radio(container, "Mobile"));
    await click(fullScreenButton(container));
    expect(studioRoot.getAttribute("data-full-screen")).toBe("false");
    expect(container.querySelector(".qa-toolbar")).toBeNull();
    expect(radio(slot, "Mobile").getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(fullScreenButton(slot));
  });

  it("draws nothing while the slot is on its way, rather than a toolbar that jumps", async () => {
    setup({ run: runAs("qa", { items: ITEMS }) });
    await render(<QaStudioPanel projectId="project-1" appRole="qa" toolbarSlot={null} />);
    expect(document.querySelector(".qa-toolbar")).toBeNull();
    expect(document.querySelector("iframe")).not.toBeNull();
  });
});
