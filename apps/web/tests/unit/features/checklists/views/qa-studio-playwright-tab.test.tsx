import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { checklistsRepository } from "../../../../../src/features/checklists/data/checklists-repository";
import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { qaRunsRepository } from "../../../../../src/features/checklists/data/qa-runs-repository";
import { normalizeProjectRunCurrent } from "../../../../../src/features/checklists/model/project-run-rules";
import type { QaRun } from "../../../../../src/features/checklists/model/qa-run-types";
import type { QaScope } from "../../../../../src/features/checklists/model/qa-scope";
import type { RenderRepositoryChecks } from "../../../../../src/features/checklists/studio";
import { QaStudioPanel } from "../../../../../src/features/checklists/studio/views/qa-studio-panel";
import { projectsRepository } from "../../../../../src/features/projects/data/projects-repository";
import type { AppRole, ProjectBranchPreview } from "../../../../../src/shared/api/contracts";
import { checklist } from "../checklist-fixtures";
import { automated, automation, verifyFailure } from "../qa-automation-fixtures";
import { promotionWire } from "../qa-promotion-fixtures";
import { runAs, runItem } from "../qa-run-fixtures";
import { projectRunWire, runItemWire } from "../requirement-fixtures";

jest.mock("../../../../../src/features/checklists/data/checklists-repository", () => ({
  checklistsRepository: { listForProject: jest.fn() },
}));
jest.mock("../../../../../src/features/checklists/data/qa-runs-repository", () => ({
  qaRunsRepository: {
    current: jest.fn(),
    create: jest.fn(),
    get: jest.fn(),
    updateItem: jest.fn(),
    requestRetest: jest.fn(),
    signoff: jest.fn(),
    reopen: jest.fn(),
    dispatchAutomation: jest.fn(),
    promotion: jest.fn(),
    mergePromotion: jest.fn(),
  },
}));
jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: {
    current: jest.fn(),
    start: jest.fn(),
    get: jest.fn(),
    setVerification: jest.fn(),
    signoff: jest.fn(),
    reopen: jest.fn(),
    dispatchAutomation: jest.fn(),
  },
}));
jest.mock("../../../../../src/features/projects/data/projects-repository", () => ({
  projectsRepository: { previews: jest.fn() },
}));

const checklists = checklistsRepository as jest.Mocked<typeof checklistsRepository>;
const runs = qaRunsRepository as jest.Mocked<typeof qaRunsRepository>;
const projectRuns = projectQaRunsRepository as jest.Mocked<typeof projectQaRunsRepository>;
const projects = projectsRepository as jest.Mocked<typeof projectsRepository>;

const PREVIEW: ProjectBranchPreview = {
  branch: "uat",
  isProduction: false,
  deploymentId: "d1",
  targetId: "web",
  targetName: "storefront-web",
  provider: "vercel",
  status: "ready",
  commitSha: "9f8e7d6",
  commitMessage: null,
  pullRequestNumber: null,
  previewUrl: "https://shop.example.com",
  inspectorUrl: null,
  createdAt: null,
  readyAt: null,
  embeddable: true,
  embedBlockedReason: null,
  surface: "page",
};

const PROJECT_SCOPE: QaScope = { kind: "project", deliveryProjectId: "dp-1", projectName: "storefront", projectHref: null };

const VERIFY_API = verifyFailure({ status: "success", tests: { total: 9, passed: 9, failed: 0, failures: [], failuresTruncated: false } });

/** A Project run with results for both repositories, two failed items and one inferred pass. */
function automatedRun(overrides: Record<string, unknown> = {}) {
  return projectRunWire({
    automation: automation(),
    automationByRepository: [
      { projectId: "proj-fe", repoFullName: "tone/storefront-web", automation: automation() },
      { projectId: "proj-be", repoFullName: "tone/orders-api", automation: { verify: VERIFY_API, quality: null } },
    ],
    items: [
      runItemWire({ title: "Pays with a saved card", verificationType: "playwright", testIdentifier: "e2e/checkout.spec.ts", automated: automated() }),
      runItemWire({
        id: "run-item-2",
        position: 1,
        title: "Coupon per line",
        automated: automated({ matchedSpec: "e2e/cart.spec.ts", failure: { name: "e2e/cart.spec.ts › applies a coupon", message: "Expected ₱2,480" } }),
      }),
      runItemWire({
        id: "run-item-3",
        position: 2,
        title: "Home page loads",
        requirementName: "Release smoke test",
        requirementKind: "system",
        automated: automated({ status: "passed", matchedSpec: "e2e/home.spec.ts", failure: null, inferred: true }),
      }),
      runItemWire({ id: "run-item-4", position: 3, title: "Email arrives" }),
    ],
    ...overrides,
  });
}

function setup(projectRun: unknown | "none" = automatedRun(), repositoryRun: QaRun | null = null) {
  projects.previews.mockResolvedValue({ enabled: true, liveProvidersEnabled: true, providerError: null, branches: [PREVIEW] });
  checklists.listForProject.mockResolvedValue({ items: [checklist()], canManage: false });
  runs.current.mockResolvedValue({ commitSha: "9f8e7d6c5b4a", commitSource: "deployment", run: repositoryRun });
  runs.promotion.mockResolvedValue(promotionWire() as never);
  projectRuns.current.mockResolvedValue(normalizeProjectRunCurrent({ run: projectRun === "none" ? null : projectRun }));
}

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  window.localStorage.clear();
  jest.clearAllMocks();
});

async function settle() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function studio(
  role: AppRole,
  options: { scope?: QaScope; po?: boolean; checks?: RenderRepositoryChecks } = {},
): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <QaStudioPanel
        projectId="project-1"
        appRole={role}
        projectName="tone/storefront-web"
        qaScope={"scope" in options ? options.scope : PROJECT_SCOPE}
        studio={options.po ? "po" : undefined}
        renderRepositoryChecks={options.checks}
      />,
    );
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

function tab(container: HTMLElement, name: "checklist" | "playwright"): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>(`.qa-coltab[data-tab="${name}"]`)!;
}

function panel(container: HTMLElement, name: "checklist" | "playwright"): HTMLElement {
  return container.querySelector<HTMLElement>(`.qa-colpanel[data-tab="${name}"]`)!;
}

function buttonNamed(scope: ParentNode, name: string): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll("button")].find((button) => button.textContent?.includes(name));
}

describe("Studio column — one container", () => {
  it("stacks the tab bar (tabs, readiness chip), the merge outcome's live region, then the panels", async () => {
    setup();
    const container = await studio("qa");
    const column = container.querySelector<HTMLElement>(".qa-studio__run")!;
    const order = [...column.children].map((child) => child.getAttribute("role") ?? child.className);
    expect(order).toEqual(["qa-coltabs-bar", "status", "tabpanel", "tabpanel"]);
    // No promotion strip: the checklist panel starts right under the bar (the live region is empty).
    expect(column.querySelector(".qa-promo")).toBeNull();
    expect(column.querySelector('[role="status"]')?.childElementCount).toBe(0);
    const bar = column.querySelector(".qa-coltabs-bar")!;
    expect(bar.querySelector('[role="tablist"]')).not.toBeNull();
    expect(bar.querySelector(".qa-promo-chip")).not.toBeNull();
    expect(panel(container, "checklist").hidden).toBe(false);
    expect(panel(container, "playwright").hidden).toBe(true);
  });

  it("is a proper tablist: selection, one tab stop, panels labelled by their tabs", async () => {
    setup();
    const container = await studio("qa");
    const tablist = container.querySelector('[role="tablist"]')!;
    expect(tablist.getAttribute("aria-label")).toBe("QA checklist and Playwright");
    const checklistTab = tab(container, "checklist");
    const playwrightTab = tab(container, "playwright");
    expect(checklistTab.getAttribute("aria-selected")).toBe("true");
    expect(checklistTab.tabIndex).toBe(0);
    expect(playwrightTab.tabIndex).toBe(-1);
    expect(checklistTab.getAttribute("aria-controls")).toBe(panel(container, "checklist").id);
    expect(panel(container, "playwright").getAttribute("aria-labelledby")).toBe(playwrightTab.id);
  });

  it("moves with the arrow keys and focuses the tab it selects", async () => {
    setup();
    const container = await studio("qa");
    const checklistTab = tab(container, "checklist");
    checklistTab.focus();
    await act(async () => {
      checklistTab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(tab(container, "playwright").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab(container, "playwright"));
    expect(panel(container, "playwright").hidden).toBe(false);
    expect(panel(container, "checklist").hidden).toBe(true);
    await act(async () => {
      tab(container, "playwright").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    expect(document.activeElement).toBe(tab(container, "checklist"));
  });

  it("remembers the tab per viewer", async () => {
    setup();
    let container = await studio("qa");
    await click(tab(container, "playwright"));
    expect(window.localStorage.getItem("alphaci.qa-studio.column-tab")).toBe("playwright");
    act(() => root?.unmount());
    container = await studio("qa");
    expect(tab(container, "playwright").getAttribute("aria-selected")).toBe("true");
  });

  it("carries the verify verdict on the Playwright label, short, and in words for screen readers", async () => {
    setup();
    const container = await studio("qa");
    const label = tab(container, "playwright");
    expect(label.querySelector(".qa-coltab__status")?.textContent).toBe("·27/29");
    expect(label.querySelector(".qa-coltab__status")?.getAttribute("data-tone")).toBe("failed");
    expect(label.querySelector(".sr-only")?.textContent).toBe(", 27 of 29 browser tests passed");
  });

  it("says nothing on the label before anything reported", async () => {
    setup(automatedRun({ automation: { verify: null, quality: null }, automationByRepository: [] }));
    const container = await studio("qa");
    expect(tab(container, "playwright").textContent).toBe("Playwright");
  });
});

describe("Studio column — the Checklist tab", () => {
  it("is the Project QA run, without the automated tests panel", async () => {
    setup();
    const container = await studio("qa");
    const checklistPanel = panel(container, "checklist");
    expect(checklistPanel.textContent).toContain("Project QA run");
    expect(checklistPanel.querySelectorAll(".pqa-group").length).toBeGreaterThan(0);
    expect(checklistPanel.querySelector(".qa-auto-stage")).toBeNull();
    expect(buttonNamed(checklistPanel, "Run Playwright")).toBeUndefined();
  });

  it("is the acceptance in PO Studio", async () => {
    setup();
    const container = await studio("lead", { po: true });
    expect(panel(container, "checklist").textContent).toContain("Product acceptance");
    expect(container.querySelector('[role="tablist"]')?.getAttribute("aria-label")).toBe("Acceptance and Playwright");
  });

  it("keeps the per-repository run for a repository outside a Project", async () => {
    setup("none", runAs("qa", { items: [runItem(0, { title: "Pays", automated: automated() })], automation: automation() }));
    const container = await studio("qa", { scope: { kind: "repository" } });
    const checklistPanel = panel(container, "checklist");
    expect(checklistPanel.querySelector(".qa-run-item")).not.toBeNull();
    // Each item keeps its own result; the stage cards moved to Playwright.
    expect(checklistPanel.querySelector(".qa-auto-badge")).not.toBeNull();
    expect(checklistPanel.querySelector(".qa-auto-stage")).toBeNull();
    expect(panel(container, "playwright").querySelectorAll(".qa-auto-stage")).toHaveLength(2);
  });
});

describe("Studio column — the Playwright tab", () => {
  it("shows each repository's stages with counts, the pass bar and failures that unfold", async () => {
    setup();
    const container = await studio("qa");
    await click(tab(container, "playwright"));
    const repos = [...panel(container, "playwright").querySelectorAll<HTMLElement>(".qa-pw-repo")];
    expect(repos.map((repo) => repo.querySelector(".qa-pw-repo__name")?.textContent)).toEqual(["storefront-web", "orders-api"]);
    expect(repos[0].querySelector(".qa-pw-repo__sha")?.textContent).toBe("uat @ a1b2c3d");
    expect(repos[0].querySelector(".qa-auto-stage__count")?.textContent).toBe("18 / 20 passed");
    expect(repos[0].querySelector<HTMLElement>(".qa-auto-stage__fill")?.style.width).toBe("90%");
    const failures = repos[0].querySelector<HTMLElement>(".qa-auto-failures")!;
    expect(failures.hidden).toBe(true);
    await click(repos[0].querySelector("button.qa-auto-stage__failed"));
    expect(failures.hidden).toBe(false);
    expect(failures.querySelector(".qa-auto-failure__message")?.textContent).toMatch(/Timed out 5000ms/);
    expect(repos[1].querySelector(".qa-auto-stage__count")?.textContent).toBe("9 / 9 passed");
    expect(repos[1].querySelector(".qa-auto-stage--missing")?.textContent).toContain("Not reported");
    expect(panel(container, "playwright").querySelector("a")).toBeNull();
  });

  it("lists the requirements with automated tests, failed first, an inferred pass not confirmed", async () => {
    setup();
    const container = await studio("qa");
    const rows = [...panel(container, "playwright").querySelectorAll<HTMLElement>(".qa-pw-item")];
    expect(rows.map((row) => row.querySelector(".qa-pw-item__title")?.textContent)).toEqual([
      "Pays with a saved card",
      "Coupon per line",
      "Home page loads",
    ]);
    expect(rows[1].querySelector(".qa-pw-item__failure")?.textContent).toBe("Expected ₱2,480");
    expect(rows[2].querySelector(".qa-auto-badge__status")?.textContent).toBe("Passed (not confirmed)");
    expect(rows[2].querySelector(".qa-pw-item__hint")?.textContent).toMatch(/Older pipeline/);
    expect(rows[2].textContent).toContain("Release smoke test");
  });

  it.each<[AppRole, boolean]>([
    ["qa", true],
    ["lead", true],
    ["admin", true],
    ["member", false],
  ])("offers Run Playwright to %s: %s", async (role, offered) => {
    setup();
    const container = await studio(role);
    expect(Boolean(buttonNamed(panel(container, "playwright"), "Run Playwright"))).toBe(offered);
  });

  it("runs Playwright on the Project run's endpoint and confirms in the live region", async () => {
    setup();
    projectRuns.dispatchAutomation.mockResolvedValue({
      dispatched: [{ projectId: "proj-fe", repoFullName: "tone/storefront-web", ref: "uat", headSha: "a1b2c3d", targetsRunCommit: true }],
      failed: [],
    });
    const container = await studio("qa");
    await click(buttonNamed(panel(container, "playwright"), "Run Playwright"));
    expect(projectRuns.dispatchAutomation).toHaveBeenCalledWith("dp-1", "prun-1");
    expect(runs.dispatchAutomation).not.toHaveBeenCalled();
    expect(panel(container, "playwright").querySelector('[role="status"]')?.textContent).toContain(
      "Playwright started on uat in storefront-web.",
    );
  });

  it("hands each repository to the host's checks, only once the tab is opened", async () => {
    setup();
    const checks = jest.fn<React.ReactNode, Parameters<RenderRepositoryChecks>>((repository) => (
      <p className="host-check">Visual for {repository.repoFullName}</p>
    ));
    const container = await studio("qa", { checks });
    expect(checks).not.toHaveBeenCalled();
    await click(tab(container, "playwright"));
    expect(checks).toHaveBeenCalledWith({ projectId: "proj-fe", repoFullName: "tone/storefront-web" });
    expect(checks).toHaveBeenCalledWith({ projectId: "proj-be", repoFullName: "tone/orders-api" });
    const repos = [...panel(container, "playwright").querySelectorAll(".qa-pw-repo")];
    expect(repos[0].querySelector(".host-check")?.textContent).toBe("Visual for tone/storefront-web");
    expect(repos[1].querySelector(".host-check")?.textContent).toBe("Visual for tone/orders-api");
  });

  it("says Playwright hasn't run on uat yet, with Run Playwright, when nothing reported", async () => {
    setup(automatedRun({
      automation: { verify: null, quality: null },
      automationByRepository: [{ projectId: "proj-fe", repoFullName: "tone/storefront-web", automation: {} }],
    }));
    const container = await studio("qa");
    const playwright = panel(container, "playwright");
    expect(playwright.querySelector(".qa-auto__empty-title")?.textContent).toBe("Playwright hasn't run on uat yet");
    expect(buttonNamed(playwright, "Run Playwright")).toBeDefined();
  });

  it("says the server doesn't report automated results on an older backend, with no dispatch", async () => {
    setup(projectRunWire());
    const container = await studio("qa");
    const playwright = panel(container, "playwright");
    expect(playwright.textContent).toContain("This server doesn't report automated results.");
    expect(buttonNamed(playwright, "Run Playwright")).toBeUndefined();
    expect(tab(container, "playwright").textContent).toBe("Playwright");
  });

  it("asks for a run first when the Project has none", async () => {
    setup("none");
    const container = await studio("qa");
    expect(panel(container, "playwright").textContent).toContain("No QA run yet");
  });

  it("shows the same results in PO Studio, where a Product owner may run Playwright", async () => {
    setup();
    const container = await studio("lead", { po: true });
    const playwright = panel(container, "playwright");
    expect(playwright.querySelectorAll(".qa-pw-repo")).toHaveLength(2);
    expect(buttonNamed(playwright, "Run Playwright")).toBeDefined();
  });
});

const SIGNOFF = {
  id: "s1",
  verdict: "APPROVED",
  summary: null,
  conditions: null,
  signedBy: { id: "u", login: "ana-qa" },
  signedAt: "2026-10-01T10:00:00Z",
};

/** A signed-off Project run with results; `canReopen` is the server's flag for this viewer. */
function signedRun(canReopen: boolean) {
  return automatedRun({
    status: "signed_off",
    signoff: SIGNOFF,
    permissions: { canSetVerification: false, canSignOff: false, canReopen, canDispatch: false },
  });
}

function dialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

function runPlaywright(container: HTMLElement): HTMLButtonElement {
  return buttonNamed(panel(container, "playwright"), "Run Playwright")!;
}

function reopenButton(container: HTMLElement): HTMLButtonElement | undefined {
  return [...panel(container, "playwright").querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Reopen run",
  );
}

describe("Studio column — Reopen beside a blocked Run Playwright", () => {
  it("offers Reopen run beside the disabled Run Playwright of a signed-off run, for a viewer who may reopen", async () => {
    setup(signedRun(true));
    const container = await studio("lead");
    const run = runPlaywright(container);
    expect(run.disabled).toBe(true);
    const reopen = reopenButton(container)!;
    expect(reopen).toBeDefined();
    expect(reopen.parentElement).toBe(run.parentElement);
    const why = document.getElementById(run.getAttribute("aria-describedby")!);
    expect(why?.textContent).toBe("This run is signed off. Reopen it to run Playwright.");
  });

  it("asks first, saying reopening blocks Merge to main, and cancelling sends nothing", async () => {
    setup(signedRun(true));
    const container = await studio("lead");
    await click(reopenButton(container));
    expect(dialog()?.textContent).toContain("Reopen this run?");
    expect(dialog()?.textContent).toContain(
      "Reopening removes this run's sign-off. Merge to main stays blocked until QA signs the run off Approved again.",
    );
    const cancel = [...dialog()!.querySelectorAll("button")].find((button) => button.textContent === "Cancel");
    await click(cancel);
    expect(projectRuns.reopen).not.toHaveBeenCalled();
    expect(runPlaywright(container).disabled).toBe(true);
    expect(reopenButton(container)?.disabled).toBe(false);
  });

  it("reopens the Project run on confirm; the run refreshes, Run Playwright is enabled and readiness is re-read", async () => {
    setup(signedRun(true));
    const reopened = normalizeProjectRunCurrent({ run: automatedRun({ permissions: { canSetVerification: true, canSignOff: true, canReopen: false, canDispatch: true } }) }).run!;
    projectRuns.reopen.mockResolvedValue(reopened);
    const container = await studio("lead");
    const reads = runs.promotion.mock.calls.length;
    await click(reopenButton(container));
    const confirm = [...dialog()!.querySelectorAll("button")].find((button) => button.textContent === "Reopen run");
    await click(confirm);
    expect(projectRuns.reopen).toHaveBeenCalledWith("dp-1", "prun-1");
    expect(runPlaywright(container).disabled).toBe(false);
    expect(reopenButton(container)).toBeUndefined();
    expect(panel(container, "playwright").querySelector(".qa-auto__reason")).toBeNull();
    expect(runs.promotion.mock.calls.length).toBe(reads + 1);
  });

  it("keeps a refused reopen in the confirmation, to retry or cancel", async () => {
    setup(signedRun(true));
    projectRuns.reopen.mockRejectedValue(Object.assign(new Error("no"), { status: 403 }));
    const container = await studio("lead");
    await click(reopenButton(container));
    await click([...dialog()!.querySelectorAll("button")].find((button) => button.textContent === "Reopen run"));
    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe("Your role cannot make this change.");
    expect(runPlaywright(container).disabled).toBe(true);
  });

  it("is not offered to a QA viewer the server does not let reopen: the disabled button says why", async () => {
    setup(signedRun(false));
    const container = await studio("qa");
    const run = runPlaywright(container);
    expect(run.disabled).toBe(true);
    expect(reopenButton(container)).toBeUndefined();
    expect(document.getElementById(run.getAttribute("aria-describedby")!)?.textContent).toBe(
      "This run is signed off, so Playwright cannot run on it until it is reopened.",
    );
  });

  it("is not offered on an open run", async () => {
    setup(automatedRun({ permissions: { canSetVerification: true, canSignOff: true, canReopen: true, canDispatch: true } }));
    const container = await studio("lead");
    expect(runPlaywright(container).disabled).toBe(false);
    expect(reopenButton(container)).toBeUndefined();
  });

  it("reopens a signed-off repository run too, through its own route", async () => {
    const signed = runAs("lead", {
      status: "signed_off",
      signoff: { ...SIGNOFF, verdict: "APPROVED" as const },
      items: [runItem(0, { title: "Pays", automated: automated() })],
      automation: automation(),
    });
    setup("none", signed);
    runs.reopen.mockResolvedValue({ ...signed, status: "open", signoff: null });
    const container = await studio("lead", { scope: { kind: "repository" } });
    expect(runPlaywright(container).disabled).toBe(true);
    await click(reopenButton(container));
    await click([...dialog()!.querySelectorAll("button")].find((button) => button.textContent === "Reopen run"));
    expect(runs.reopen).toHaveBeenCalledWith("project-1", "run-1");
    expect(projectRuns.reopen).not.toHaveBeenCalled();
    expect(runPlaywright(container).disabled).toBe(false);
  });

  it("the Checklist tab's Reopen run goes through the same confirmation", async () => {
    setup(signedRun(true));
    const container = await studio("lead");
    const banner = panel(container, "checklist").querySelector(".qa-signoff-banner")!;
    await click([...banner.querySelectorAll("button")].find((button) => button.textContent === "Reopen run"));
    expect(projectRuns.reopen).not.toHaveBeenCalled();
    expect(dialog()?.textContent).toContain("Merge to main stays blocked until QA signs the run off Approved again.");
  });
});

describe("Studio column — full screen", () => {
  it("floats the same container (tab bar with the chip, panels) as the drawer, mounted once", async () => {
    setup();
    const container = await studio("qa");
    await click(tab(container, "playwright"));
    const column = container.querySelector(".qa-studio__run");
    const playwright = panel(container, "playwright");
    await click(container.querySelector('button[aria-label="Full screen"]'));
    expect(container.querySelector(".qa-studio")?.getAttribute("data-full-screen")).toBe("true");
    expect(container.querySelectorAll(".qa-studio__run")).toHaveLength(1);
    expect(container.querySelector(".qa-studio__run")).toBe(column);
    expect(container.querySelectorAll(".qa-colpanel")).toHaveLength(2);
    expect(panel(container, "playwright")).toBe(playwright);
    const drawer = container.querySelector('.qa-studio__run[role="region"]')!;
    expect(drawer.querySelectorAll(".qa-coltabs-bar")).toHaveLength(1);
    expect(drawer.querySelector(".qa-coltabs-bar .qa-promo-chip")).not.toBeNull();
    expect(drawer.querySelector('[role="tablist"]')).not.toBeNull();
    expect(drawer.querySelector(".qa-drawer__head")?.nextElementSibling?.className).toBe("qa-coltabs-bar");
    expect(tab(container, "playwright").getAttribute("aria-selected")).toBe("true");
  });
});
