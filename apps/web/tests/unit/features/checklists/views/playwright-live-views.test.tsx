import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { checklistsRepository } from "../../../../../src/features/checklists/data/checklists-repository";
import { playwrightLiveRepository } from "../../../../../src/features/checklists/data/playwright-live-repository";
import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { qaRunsRepository } from "../../../../../src/features/checklists/data/qa-runs-repository";
import { normalizePlaywrightLive } from "../../../../../src/features/checklists/model/playwright-live-rules";
import type { PlaywrightLiveRun } from "../../../../../src/features/checklists/model/playwright-live-types";
import { normalizeProjectRunCurrent } from "../../../../../src/features/checklists/model/project-run-rules";
import type { QaScope } from "../../../../../src/features/checklists/model/qa-scope";
import { PlaywrightLiveCard } from "../../../../../src/features/checklists/studio/views/playwright-live";
import { QaStudioPanel } from "../../../../../src/features/checklists/studio/views/qa-studio-panel";
import { projectsRepository } from "../../../../../src/features/projects/data/projects-repository";
import type { AppRole, ProjectBranchPreview } from "../../../../../src/shared/api/contracts";
import { ApiError } from "../../../../../src/shared/api/request";
import { checklist } from "../checklist-fixtures";
import { automated, automation, qualitySuccess, verifyFailure } from "../qa-automation-fixtures";
import { liveRun, liveTest } from "../playwright-live-fixtures";
import { promotionWire } from "../qa-promotion-fixtures";
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
jest.mock("../../../../../src/features/checklists/data/playwright-live-repository", () => ({
  playwrightLiveRepository: { getPlaywrightLive: jest.fn() },
}));
jest.mock("../../../../../src/features/projects/data/projects-repository", () => ({
  projectsRepository: { previews: jest.fn() },
}));

const checklists = checklistsRepository as jest.Mocked<typeof checklistsRepository>;
const runs = qaRunsRepository as jest.Mocked<typeof qaRunsRepository>;
const projectRuns = projectQaRunsRepository as jest.Mocked<typeof projectQaRunsRepository>;
const live = playwrightLiveRepository as jest.Mocked<typeof playwrightLiveRepository>;
const projects = projectsRepository as jest.Mocked<typeof projectsRepository>;

function run(overrides: Record<string, unknown> = {}): PlaywrightLiveRun {
  return normalizePlaywrightLive({ run: liveRun(overrides) })!;
}

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  window.localStorage.clear();
  jest.clearAllMocks();
  jest.useRealTimers();
});

async function settle() {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function mount(node: React.ReactNode): Promise<HTMLElement> {
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

function buttonNamed(scope: ParentNode, name: string): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll("button")].find((button) => button.textContent?.includes(name));
}

function card(run: PlaywrightLiveRun, name = "storefront-web") {
  return mount(<div className="qa-studio"><PlaywrightLiveCard run={run} name={name} /></div>);
}

describe("PlaywrightLiveCard — the header and bar", () => {
  it.each<[Record<string, unknown>, string, string]>([
    [{ status: "queued", total: null, done: 0, tests: [], running: [] }, "Queued", ""],
    [{ status: "starting", stage: "Install Playwright browsers", total: null, done: 0, tests: [], running: [] }, "Starting", "Install Playwright browsers"],
    [{ status: "running" }, "Running tests", "4 of 12"],
    [{ status: "passed", done: 12, passed: 12, failed: 0, finishedAt: "2026-10-08T02:01:01.000Z" }, "Passed", "12 of 12 · 1m 01s"],
    [{ status: "failed", done: 12, passed: 11, failed: 1 }, "Failed", "1 failed"],
  ])("says %p", async (overrides, label, detail) => {
    const container = await card(run(overrides));
    expect(container.querySelector(".qa-live .qa-pill")?.textContent).toBe(label);
    expect(container.querySelector(".qa-live__detail")?.textContent ?? "").toBe(detail);
    expect(container.querySelector(".qa-live__heading .sr-only")?.textContent).toBe("Playwright in storefront-web: ");
  });

  it("draws progress as a labelled progressbar of done over total", async () => {
    const container = await card(run());
    const bar = container.querySelector<HTMLElement>('[role="progressbar"]')!;
    expect(bar.getAttribute("aria-label")).toBe("Playwright progress in storefront-web");
    expect(bar.getAttribute("aria-valuenow")).toBe("33");
    expect(bar.getAttribute("aria-valuetext")).toBe("4 of 12");
    expect(bar.dataset.indeterminate).toBe("false");
    expect(bar.querySelector<HTMLElement>(".qa-live__fill")?.style.width).toBe("33%");
  });

  it("is indeterminate while the total is unknown", async () => {
    const container = await card(run({ total: null }));
    const bar = container.querySelector<HTMLElement>('[role="progressbar"]')!;
    expect(bar.dataset.indeterminate).toBe("true");
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(bar.getAttribute("aria-valuetext")).toBe("Waiting for the test count");
  });
});

describe("PlaywrightLiveCard — tests", () => {
  it("lists the tests running now, with a decorative indicator", async () => {
    const container = await card(run());
    const now = container.querySelector(".qa-live__now")!;
    expect(now.querySelector(".qa-live__label")?.textContent).toBe("Now running");
    expect(now.querySelector(".qa-live__title")?.textContent).toBe("adds to cart");
    expect(now.querySelector(".qa-live__meta")?.textContent).toBe("e2e/cart.spec.ts · chromium");
    expect(now.querySelector(".qa-live__spinner")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("drops Now running once the run finished", async () => {
    const container = await card(run({ status: "failed", finishedAt: "2026-10-08T02:01:01.000Z" }));
    expect(container.querySelector(".qa-live__now")).toBeNull();
  });

  it("lists finished tests newest first with status, title, file, browser and duration", async () => {
    const container = await card(run());
    const toggle = container.querySelector<HTMLButtonElement>(".qa-live__toggle")!;
    expect(toggle.textContent).toBe("Finished · 3 passed · 1 failed");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const rows = [...container.querySelectorAll<HTMLElement>(".qa-live__test")];
    expect(rows.map((row) => row.querySelector(".qa-live__title")?.textContent)).toEqual([
      "pays with a saved card",
      "shows no results",
      "finds a product",
      "home page loads",
    ]);
    expect(rows[0].dataset.status).toBe("failed");
    expect(rows[0].querySelector(".qa-live__icon .sr-only")?.textContent).toBe("Failed: ");
    expect(rows[1].querySelector(".qa-live__meta")?.textContent).toBe("e2e/search.spec.ts · chromium · 820 ms");
    expect(rows[3].querySelector(".qa-live__meta")?.textContent).toBe("e2e/home.spec.ts · chromium · 1.4s");
  });

  it("unfolds a failed test's error, monospace and wrapped", async () => {
    const container = await card(run());
    const failed = container.querySelector<HTMLElement>('.qa-live__test[data-status="failed"]')!;
    const expand = failed.querySelector<HTMLButtonElement>("button.qa-live__expand")!;
    const error = failed.querySelector<HTMLElement>("pre.qa-live__error")!;
    expect(error.hidden).toBe(true);
    expect(expand.getAttribute("aria-controls")).toBe(error.id);
    await click(expand);
    expect(expand.getAttribute("aria-expanded")).toBe("true");
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe("Timed out 5000ms waiting for getByRole('button', { name: 'Pay' })");
  });

  it("caps the list at 50 with Show all", async () => {
    const tests = Array.from({ length: 60 }, (_, index) => liveTest({ id: `t${index}`, title: `test ${index}` }));
    const container = await card(run({ tests, done: 60, total: 60, passed: 60, failed: 0 }));
    expect(container.querySelectorAll(".qa-live__test")).toHaveLength(50);
    expect(container.querySelector(".qa-live__test .qa-live__title")?.textContent).toBe("test 59");
    await click(buttonNamed(container, "Show all 60 tests"));
    expect(container.querySelectorAll(".qa-live__test")).toHaveLength(60);
    expect(buttonNamed(container, "Show all")).toBeUndefined();
  });

  it("gives a skipped test no duration", async () => {
    const container = await card(run({ tests: [liveTest({ status: "skipped", durationMs: 0 })] }));
    expect(container.querySelector(".qa-live__test .qa-live__meta")?.textContent).toBe("e2e/home.spec.ts · chromium");
    expect(container.querySelector(".qa-live__icon .sr-only")?.textContent).toBe("Skipped: ");
  });

  it("folds the list of a run first seen already finished", async () => {
    const container = await card(run({ status: "passed", failed: 0, passed: 4, finishedAt: "2026-10-08T02:01:01.000Z" }));
    const toggle = container.querySelector<HTMLButtonElement>(".qa-live__toggle")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)?.hidden).toBe(true);
  });
});

/* ── In the studio: roles, live progress and the fallback ─────────────────── */

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

const SCOPE: QaScope = {
  kind: "project",
  deliveryProjectId: "dp-1",
  projectName: "storefront",
  projectHref: null,
  repositoryRoles: { "proj-fe": "frontend", "proj-be": "backend" },
};

const API_VERIFY = verifyFailure({ status: "success", tests: { total: 9, passed: 9, failed: 0, failures: [], failuresTruncated: false } });

function projectRun() {
  return projectRunWire({
    automation: automation(),
    automationByRepository: [
      { projectId: "proj-fe", repoFullName: "tone/storefront-web", automation: automation() },
      { projectId: "proj-be", repoFullName: "tone/orders-api", automation: { verify: API_VERIFY, quality: qualitySuccess() } },
    ],
    items: [
      runItemWire({ title: "Pays with a saved card", automated: automated() }),
      runItemWire({ id: "run-item-2", position: 1, title: "Totals round", automated: automated({ source: "unit_test", stage: "quality", status: "passed", failure: null }) }),
    ],
  });
}

function setup() {
  projects.previews.mockResolvedValue({ enabled: true, liveProvidersEnabled: true, providerError: null, branches: [PREVIEW] });
  checklists.listForProject.mockResolvedValue({ items: [checklist()], canManage: false });
  runs.current.mockResolvedValue({ commitSha: "9f8e7d6c5b4a", commitSource: "deployment", run: null });
  runs.promotion.mockResolvedValue(promotionWire() as never);
  const current = normalizeProjectRunCurrent({ run: projectRun() });
  projectRuns.current.mockResolvedValue(current);
  projectRuns.get.mockResolvedValue(current.run!);
}

async function studio(role: AppRole, options: { po?: boolean } = {}): Promise<HTMLElement> {
  window.localStorage.setItem(`alphaci.${options.po ? "po" : "qa"}-studio.column-tab`, "playwright");
  return mount(
    <QaStudioPanel
      projectId="proj-fe"
      appRole={role}
      projectName="tone/storefront-web"
      qaScope={SCOPE}
      studio={options.po ? "po" : undefined}
    />,
  );
}

function playwrightPanel(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>('.qa-colpanel[data-tab="playwright"]')!;
}

function playwrightTab(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>('.qa-coltab[data-tab="playwright"]')!;
}

describe("Studio roles", () => {
  it("QA Team: browser tests only — no backend repository, no Quality stage, a browser-only count", async () => {
    setup();
    live.getPlaywrightLive.mockResolvedValue(null);
    const container = await studio("qa");
    const panel = playwrightPanel(container);
    expect([...panel.querySelectorAll(".qa-pw-repo__name")].map((name) => name.textContent)).toEqual(["storefront-web"]);
    expect([...panel.querySelectorAll(".qa-auto-stage__title")].map((title) => title.textContent)).toEqual([
      "Verify — browser & API tests",
    ]);
    expect(panel.querySelector(".qa-auto-stage--missing")).toBeNull();
    expect(playwrightTab(container).querySelector(".qa-coltab__status")?.textContent).toBe("·18/20");
    expect([...panel.querySelectorAll(".qa-pw-item__title")].map((title) => title.textContent)).toEqual(["Pays with a saved card"]);
    expect(buttonNamed(panel, "Run Playwright")).toBeDefined();
    // Live progress is read for the frontend only.
    expect(live.getPlaywrightLive.mock.calls).toEqual([["proj-fe", "uat"]]);
  });

  it("admin: the full view — both repositories, both stages, everything counted", async () => {
    setup();
    live.getPlaywrightLive.mockResolvedValue(null);
    const container = await studio("admin");
    const panel = playwrightPanel(container);
    expect(panel.querySelectorAll(".qa-pw-repo")).toHaveLength(2);
    expect(panel.querySelectorAll(".qa-auto-stage")).toHaveLength(4);
    expect(playwrightTab(container).querySelector(".qa-coltab__status")?.textContent).toBe("·27/29");
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2);
  });

  it("Team lead in PO Studio: no tablist, no Playwright, no live reads; the chip and Merge to main stay", async () => {
    setup();
    live.getPlaywrightLive.mockResolvedValue(run());
    const container = await studio("lead", { po: true });
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(container.querySelector('[role="tab"]')).toBeNull();
    expect(playwrightPanel(container)).toBeNull();
    expect(container.querySelector('.qa-colpanel[data-tab="checklist"]')?.textContent).toContain("Product acceptance");
    expect(container.querySelector(".qa-coltabs-bar .qa-promo-chip")).not.toBeNull();
    expect(buttonNamed(container, "Run Playwright")).toBeUndefined();
    expect(live.getPlaywrightLive).not.toHaveBeenCalled();
  });
});

describe("Live progress in the Playwright tab", () => {
  it("shows the live card at the top of the frontend's section, and announces milestones politely", async () => {
    setup();
    live.getPlaywrightLive.mockResolvedValue(run());
    const container = await studio("qa");
    const section = playwrightPanel(container).querySelector(".qa-pw-repo")!;
    const liveCard = section.querySelector(".qa-live")!;
    expect(liveCard.querySelector(".qa-live__detail")?.textContent).toBe("4 of 12");
    // Above the stage cards.
    expect(liveCard.compareDocumentPosition(section.querySelector(".qa-auto-stage")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const region = playwrightPanel(container).querySelector('[data-live="playwright"]')!;
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toBe("Playwright is running in storefront-web.");
  });

  it("after Run Playwright: a short line while waiting, then the live view replaces it, and the end refreshes the run", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse("2026-10-08T02:00:00.000Z"));
    setup();
    const finished = run({ runId: 200, status: "failed", done: 12, passed: 11, failed: 1, finishedAt: "2026-10-08T02:01:01.000Z" });
    live.getPlaywrightLive
      .mockResolvedValueOnce(null) // on open
      .mockResolvedValueOnce(null) // right after the dispatch
      .mockResolvedValueOnce(run({ runId: 200, status: "queued", done: 0, passed: 0, failed: 0, total: null, tests: [], running: [] }))
      .mockResolvedValueOnce(run({ runId: 200 }))
      .mockResolvedValue(finished);
    projectRuns.dispatchAutomation.mockResolvedValue({
      dispatched: [{ projectId: "proj-fe", repoFullName: "tone/storefront-web", ref: "uat", headSha: "a1b2c3d", targetsRunCommit: true }],
      failed: [],
    });
    const container = await studio("qa");
    const panel = playwrightPanel(container);
    await click(buttonNamed(panel, "Run Playwright"));
    const status = () => panel.querySelector(".qa-auto__live")!;
    expect(status().textContent).toBe("Playwright started on uat in storefront-web. Waiting for its first progress report…");
    expect(panel.querySelector(".qa-live")).toBeNull();

    const tick = async () => {
      await act(async () => {
        jest.advanceTimersByTime(3_000);
      });
      await settle();
    };
    await tick();
    expect(panel.querySelector(".qa-live .qa-pill")?.textContent).toBe("Queued");
    expect(status().textContent).toBe("");
    expect(panel.querySelector('[data-live="playwright"]')?.textContent).toBe("Playwright started in storefront-web.");

    await tick();
    expect(panel.querySelector(".qa-live__detail")?.textContent).toBe("4 of 12");
    expect(panel.querySelector('[data-live="playwright"]')?.textContent).toBe("Failed in storefront-web: pays with a saved card.");

    const reads = projectRuns.get.mock.calls.length;
    await tick();
    expect(panel.querySelector(".qa-live .qa-pill")?.textContent).toBe("Failed");
    expect(panel.querySelector('[data-live="playwright"]')?.textContent).toBe("Playwright failed in storefront-web: 1 failed · 1m 01s.");
    expect(projectRuns.get.mock.calls.length).toBe(reads + 1);
    expect(panel.querySelector("a")).toBeNull();
  });

  it("opens a new run's list even when the previous run's was folded", async () => {
    jest.useFakeTimers();
    setup();
    const previous = run({ runId: 100, status: "passed", failed: 0, passed: 4, finishedAt: "2026-10-08T02:01:01.000Z" });
    live.getPlaywrightLive.mockResolvedValueOnce(previous).mockResolvedValue(run({ runId: 101 }));
    projectRuns.dispatchAutomation.mockResolvedValue({
      dispatched: [{ projectId: "proj-fe", repoFullName: "tone/storefront-web", ref: "uat", headSha: "a1b2c3d", targetsRunCommit: true }],
      failed: [],
    });
    const container = await studio("qa");
    const panel = playwrightPanel(container);
    expect(panel.querySelector(".qa-live__toggle")?.getAttribute("aria-expanded")).toBe("false");
    await click(buttonNamed(panel, "Run Playwright"));
    expect(panel.querySelector(".qa-live .qa-pill")?.textContent).toBe("Running tests");
    expect(panel.querySelector(".qa-live__toggle")?.getAttribute("aria-expanded")).toBe("true");
  });

  it("falls back to today's behaviour on a backend without the live route (404)", async () => {
    setup();
    live.getPlaywrightLive.mockRejectedValue(new ApiError("Cannot GET", 404));
    projectRuns.dispatchAutomation.mockResolvedValue({
      dispatched: [{ projectId: "proj-fe", repoFullName: "tone/storefront-web", ref: "uat", headSha: "a1b2c3d", targetsRunCommit: true }],
      failed: [],
    });
    const container = await studio("qa");
    const panel = playwrightPanel(container);
    await click(buttonNamed(panel, "Run Playwright"));
    expect(panel.querySelector(".qa-auto__live")?.textContent).toBe(
      "Playwright started on uat in storefront-web. Results appear here when the runs report. Checking every 20 seconds.",
    );
    expect(panel.querySelector(".qa-live")).toBeNull();
    expect(live.getPlaywrightLive).toHaveBeenCalledTimes(1);
  });
});
