import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { checklistsRepository } from "../../../../../src/features/checklists/data/checklists-repository";
import { qaRunsRepository } from "../../../../../src/features/checklists/data/qa-runs-repository";
import { projectsRepository } from "../../../../../src/features/projects/data/projects-repository";
import { QaStudioPanel } from "../../../../../src/features/checklists/studio/views/qa-studio-panel";
import { QaReportDocument } from "../../../../../src/features/checklists/report/views/qa-report-document";
import type { QaReport } from "../../../../../src/features/checklists/model/qa-report-types";
import { formatReportDate } from "../../../../../src/features/checklists/model/qa-report-rules";
import type { QaRun } from "../../../../../src/features/checklists/model/qa-run-types";
import type { AppRole } from "../../../../../src/shared/api/contracts";
import { ApiError } from "../../../../../src/shared/api/request";
import { checklist } from "../checklist-fixtures";
import { automated, automation, qualitySuccess, verifyFailure } from "../qa-automation-fixtures";
import { frozenReport } from "../qa-report-fixtures";
import { runAs, runItem } from "../qa-run-fixtures";

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
    returnedItems: jest.fn(),
    dispatchAutomation: jest.fn(),
    // The studio's promotion card reads this; these tests are not about it.
    promotion: jest.fn().mockResolvedValue({}),
  },
}));
jest.mock("../../../../../src/features/projects/data/projects-repository", () => ({
  projectsRepository: { previews: jest.fn() },
}));

const checklists = checklistsRepository as jest.Mocked<typeof checklistsRepository>;
const runs = qaRunsRepository as jest.Mocked<typeof qaRunsRepository>;
const projects = projectsRepository as jest.Mocked<typeof projectsRepository>;

/** One item per automated outcome, plus a manual item and one from an older backend (no field at all). */
const ITEMS = [
  runItem(0, {
    title: "Checkout completes with a saved card",
    targetPersona: "qa",
    verificationType: "playwright",
    testIdentifier: "e2e/checkout.spec.ts",
    status: "passed",
    automated: automated(),
  }),
  runItem(1, {
    title: "Search matches a partial SKU",
    targetPersona: "qa",
    verificationType: "playwright",
    status: "passed",
    automated: automated({ status: "passed", matchedSpec: "e2e/search.spec.ts", failure: null }),
  }),
  runItem(2, {
    title: "Refund issues a credit note",
    targetPersona: "developer",
    verificationType: "unit_test",
    automated: automated({ source: "unit_test", stage: "quality", status: "unknown", scope: "suite", matchedSpec: null, failure: null }),
  }),
  runItem(3, {
    title: "POST /orders rejects an expired session",
    targetPersona: "developer",
    verificationType: "bruno",
    automated: automated({ source: "bruno", status: "not_run", scope: null, matchedSpec: null, failure: null }),
  }),
  runItem(4, { title: "Phone layout", targetPersona: "qa", automated: null }),
  runItem(5, { title: "Flags set", targetPersona: "qa" }),
];

function setup(run: QaRun | null) {
  projects.previews.mockResolvedValue({
    enabled: true,
    liveProvidersEnabled: true,
    providerError: null,
    branches: [
      {
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
      },
    ],
  });
  checklists.listForProject.mockResolvedValue({ items: [checklist()], canManage: false });
  runs.current.mockResolvedValue({ commitSha: "abc1234def", commitSource: "deployment", run });
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

function itemRow(container: HTMLElement, title: string): HTMLElement {
  const row = [...container.querySelectorAll<HTMLElement>(".qa-run-item")].find((node) =>
    node.querySelector(".qa-run-item__title")?.textContent === title,
  );
  if (!row) throw new Error(`no item ${title}`);
  return row;
}

function buttonNamed(container: ParentNode, name: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((button) => button.textContent?.includes(name));
}

function click(element: Element | null | undefined) {
  if (!element) throw new Error("element not found");
  act(() => (element as HTMLElement).click());
}

async function clickAsync(element: Element | null | undefined) {
  if (!element) throw new Error("element not found");
  await act(async () => {
    (element as HTMLElement).click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("QA Studio — item Automated badge", () => {
  it("shows a badge per automated status, beside the recorded status, and none for manual items", async () => {
    setup(runAs("qa", { items: ITEMS, automation: automation() }));
    const container = await studio("qa");
    const badge = (title: string) => itemRow(container, title).querySelector(".qa-auto-badge");
    expect(badge("Checkout completes with a saved card")?.textContent).toBe("AutomatedFailed");
    expect(badge("Checkout completes with a saved card")?.className).toContain("qa-auto-badge--danger");
    expect(badge("Search matches a partial SKU")?.textContent).toBe("AutomatedPassed");
    expect(badge("Search matches a partial SKU")?.className).toContain("qa-auto-badge--success");
    expect(badge("Refund issues a credit note")?.textContent).toBe("AutomatedUnknown");
    expect(badge("POST /orders rejects an expired session")?.textContent).toBe("AutomatedNot run");
    expect(badge("Phone layout")).toBeNull();
    expect(badge("Flags set")).toBeNull();
    // The recorded status is still the tester's.
    expect(itemRow(container, "Checkout completes with a saved card").querySelector(".qa-pill")?.textContent).toBe("Passed");
  });

  it("expands a failed badge into the sentence and the matched failure, with no link out to GitHub", async () => {
    setup(runAs("qa", { items: ITEMS, automation: automation() }));
    const container = await studio("qa");
    const row = itemRow(container, "Checkout completes with a saved card");
    const toggle = row.querySelector<HTMLButtonElement>(".qa-auto-toggle");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(toggle?.getAttribute("title")).toBe("Automated: failed in e2e/checkout.spec.ts");
    const details = row.querySelector<HTMLElement>(".qa-auto-detail");
    expect(details?.hidden).toBe(true);
    expect(toggle?.getAttribute("aria-controls")).toBe(details?.id);

    click(toggle);
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(details?.hidden).toBe(false);
    expect(details?.querySelector(".qa-auto-detail__sentence")?.textContent).toBe("Automated: failed in e2e/checkout.spec.ts");
    expect(details?.querySelector(".qa-auto-detail__meta")?.textContent).toContain("Playwright E2E · This spec · Verify stage");
    expect(details?.querySelector(".qa-auto-detail__name")?.textContent).toBe("e2e/checkout.spec.ts › pays with a saved card");
    expect(details?.querySelector(".qa-auto-detail__message")?.textContent).toBe("Timed out 5000ms");
    expect(details?.querySelector("a")).toBeNull();

    click(toggle);
    expect(details?.hidden).toBe(true);
  });

  it("explains an unknown result by the truncated failure list", async () => {
    const truncated = verifyFailure({
      stage: "quality",
      tests: {
        total: 400,
        passed: 377,
        failed: 23,
        failures: Array.from({ length: 20 }, (_, index) => ({ name: `unit ${index}`, message: "boom" })),
        failuresTruncated: true,
      },
    });
    setup(runAs("qa", { items: ITEMS, automation: { verify: verifyFailure(), quality: truncated } }));
    const container = await studio("qa");
    const row = itemRow(container, "Refund issues a credit note");
    click(row.querySelector(".qa-auto-toggle"));
    expect(row.querySelector(".qa-auto-detail__sentence")?.textContent).toBe("Automated: unknown — more failures than listed");
    expect(row.querySelector(".qa-auto-detail a")).toBeNull();
  });

  it("says not run for this commit", async () => {
    setup(runAs("qa", { items: ITEMS }));
    const container = await studio("qa");
    const toggle = itemRow(container, "POST /orders rejects an expired session").querySelector(".qa-auto-toggle");
    expect(toggle?.getAttribute("title")).toBe("Automated: not run for abc1234 yet");
  });

  it("adds a quiet hint only when the automated verdict disagrees with the recorded one", async () => {
    setup(runAs("qa", { items: ITEMS, automation: automation() }));
    const container = await studio("qa");
    expect(itemRow(container, "Checkout completes with a saved card").querySelector(".qa-auto-hint")?.textContent).toBe(
      "Automated result differs from the recorded status",
    );
    expect(itemRow(container, "Search matches a partial SKU").querySelector(".qa-auto-hint")).toBeNull();
    expect(itemRow(container, "Refund issues a credit note").querySelector(".qa-auto-hint")).toBeNull();
    expect(runs.updateItem).not.toHaveBeenCalled();
  });

  it("shows an inferred pass as Passed (not confirmed), with the reason, and a confirmed pass unchanged", async () => {
    const items = [
      runItem(0, {
        title: "Home renders",
        targetPersona: "qa",
        verificationType: "playwright",
        automated: automated({ status: "passed", matchedSpec: "e2e/home.spec.ts", failure: null, inferred: true }),
      }),
      runItem(1, {
        title: "Search works",
        targetPersona: "qa",
        verificationType: "playwright",
        automated: automated({ status: "passed", matchedSpec: "e2e/search.spec.ts", failure: null }),
      }),
    ];
    setup(runAs("qa", { items, automation: automation() }));
    const container = await studio("qa");
    const hint =
      "Older pipeline: this test wasn't in the failure list, but its pass wasn't reported. Update the pipeline to confirm passes.";

    const inferred = itemRow(container, "Home renders");
    const badge = inferred.querySelector(".qa-auto-badge");
    expect(badge?.textContent).toBe("AutomatedPassed (not confirmed)");
    expect(badge?.className).toContain("qa-auto-badge--unconfirmed");
    expect(badge?.getAttribute("title")).toBe(hint);
    expect(inferred.querySelector(".qa-auto-toggle")?.getAttribute("title")).toBe(
      `Automated: passed in e2e/home.spec.ts (not confirmed). ${hint}`,
    );
    click(inferred.querySelector(".qa-auto-toggle"));
    expect(inferred.querySelector(".qa-auto-detail")?.textContent).toContain(hint);

    const confirmed = itemRow(container, "Search works").querySelector(".qa-auto-badge");
    expect(confirmed?.textContent).toBe("AutomatedPassed");
    expect(confirmed?.className).not.toContain("qa-auto-badge--unconfirmed");
    expect(confirmed?.getAttribute("title")).toBeNull();
  });

  it("renders every item of a run from an older backend without a badge or an error", async () => {
    const legacy = runAs("qa", { items: [runItem(0, { title: "Checkout works" })] });
    setup(legacy);
    const container = await studio("qa");
    expect(container.textContent).toContain("Checkout works");
    expect(container.querySelector(".qa-auto-badge")).toBeNull();
    // The Playwright tab says the server sends no results, and offers no dispatch.
    const playwright = container.querySelector('[role="tabpanel"][data-tab="playwright"]');
    expect(playwright?.textContent).toContain("This server doesn't report automated results.");
    expect(buttonNamed(playwright!, "Run Playwright")).toBeUndefined();
  });
});

/** Runs from a server that reports automation, with nothing reported yet. */
const NOTHING_YET = { verify: null, quality: null };

describe("QA Studio — Playwright tab results", () => {
  it("shows each stage's verdict, counts and failures, with no link out to GitHub", async () => {
    setup(runAs("qa", { items: ITEMS, automation: automation() }));
    const container = await studio("qa");
    const stages = [...container.querySelectorAll<HTMLElement>(".qa-auto-stage")];
    expect(stages).toHaveLength(2);
    const [verify, quality] = stages;
    expect(verify.querySelector(".qa-auto-stage__title")?.textContent).toBe("Verify — browser & API tests");
    expect(verify.querySelector(".qa-pill")?.textContent).toBe("Failed");
    expect(verify.querySelector(".qa-auto-stage__count")?.textContent).toBe("18 / 20 passed");
    expect(verify.querySelector<HTMLElement>(".qa-auto-stage__fill")?.style.width).toBe("90%");
    // "2 failed" is the disclosure for the failures list, folded by default.
    const failedToggle = verify.querySelector<HTMLButtonElement>("button.qa-auto-stage__failed");
    expect(failedToggle?.textContent).toBe("2 failed — show 2 failures");
    expect(failedToggle?.getAttribute("aria-expanded")).toBe("false");
    const list = verify.querySelector<HTMLElement>(".qa-auto-failures");
    expect(failedToggle?.getAttribute("aria-controls")).toBe(list?.id);
    expect(list?.hidden).toBe(true);
    click(failedToggle);
    expect(failedToggle?.getAttribute("aria-expanded")).toBe("true");
    expect(list?.hidden).toBe(false);
    expect(failedToggle?.textContent).toBe("2 failed — hide 2 failures");
    const failures = [...verify.querySelectorAll(".qa-auto-failure__name")].map((node) => node.textContent);
    expect(failures).toEqual(["e2e/checkout.spec.ts › pays with a saved card", "e2e/cart.spec.ts › applies a coupon per line"]);
    expect(verify.querySelector(".qa-auto-failures__note")).toBeNull();
    expect(verify.querySelector("a")).toBeNull();
    expect(verify.querySelector("time")?.getAttribute("dateTime")).toBe("2026-09-25T06:57:00.000Z");
    expect(quality.querySelector(".qa-auto-stage__title")?.textContent).toBe("Quality — unit tests");
    expect(quality.querySelector(".qa-pill")?.textContent).toBe("Passed");
    expect(quality.querySelector(".qa-auto-stage__count")?.textContent).toBe("142 / 142 passed");
    expect(quality.querySelector(".qa-auto-stage__failed")).toBeNull();
  });

  it("notes the failures CI did not list", async () => {
    const truncated = verifyFailure({
      tests: {
        total: 60,
        passed: 37,
        failed: 23,
        failures: Array.from({ length: 20 }, (_, index) => ({ name: `e2e/t${index}.spec.ts`, message: "boom" })),
        failuresTruncated: true,
      },
    });
    setup(runAs("qa", { items: ITEMS, automation: { verify: truncated, quality: null } }));
    const container = await studio("qa");
    const verify = container.querySelector(".qa-auto-stage")!;
    expect(verify.querySelector("button.qa-auto-stage__failed")?.textContent).toBe("23 failed — show 20 of 23 failures");
    expect(verify.querySelectorAll(".qa-auto-failure")).toHaveLength(20);
    expect(verify.querySelector(".qa-auto-failures__note")?.textContent).toBe("3 more failures not listed.");
    // The stage that has not reported says so instead of vanishing.
    expect(container.querySelector(".qa-auto-stage--missing")?.textContent).toBe("Quality — unit testsNot reported for abc1234 yet");
  });

  it("shows a plain failed count when CI listed no failures, with the note still visible", async () => {
    const unlisted = verifyFailure({ tests: { total: 30, passed: 25, failed: 5, failures: [], failuresTruncated: true } });
    setup(runAs("qa", { items: ITEMS, automation: { verify: unlisted } }));
    const container = await studio("qa");
    const verify = container.querySelector(".qa-auto-stage")!;
    expect(verify.querySelector("button.qa-auto-stage__failed")).toBeNull();
    expect(verify.querySelector("span.qa-auto-stage__failed")?.textContent).toBe("5 failed");
    const note = verify.querySelector<HTMLElement>(".qa-auto-failures");
    expect(note?.hidden).toBe(false);
    expect(note?.textContent).toBe("5 more failures not listed.");
  });

  it("says when CI sent a stage without test counts", async () => {
    setup(runAs("qa", { items: ITEMS, automation: { verify: { status: "running" } } }));
    const container = await studio("qa");
    const verify = container.querySelector(".qa-auto-stage")!;
    expect(verify.className).toContain("qa-auto-stage--brand");
    expect(verify.querySelector(".qa-pill")?.textContent).toBe("Running");
    expect(verify.textContent).toContain("No test counts reported");
    expect(verify.querySelector("a")).toBeNull();
  });

  it("says the server reports no automated results when the run carries no automation at all", async () => {
    setup(runAs("qa", { items: ITEMS }));
    const container = await studio("qa");
    expect(container.querySelector(".qa-auto__empty-title")).toBeNull();
    expect(container.querySelector(".qa-auto-stage")).toBeNull();
    expect(container.querySelector('[data-tab="playwright"].qa-colpanel')?.textContent).toContain(
      "This server doesn't report automated results.",
    );
  });

  it("says Playwright has not run yet when both stages are null", async () => {
    setup(runAs("qa", { items: ITEMS, automation: NOTHING_YET }));
    const container = await studio("qa");
    expect(container.querySelector(".qa-auto__empty-title")?.textContent).toBe("Playwright hasn't run on main yet");
    expect(container.querySelector(".qa-auto__empty-text")?.textContent).toContain("Run Playwright to start it now.");
  });

  it("is not inside the Checklist tab any more: the run there keeps only its items' own results", async () => {
    setup(runAs("qa", { items: ITEMS, automation: automation() }));
    const container = await studio("qa");
    const checklist = container.querySelector<HTMLElement>('[role="tabpanel"][data-tab="checklist"]')!;
    expect(checklist.querySelector(".qa-auto-stage")).toBeNull();
    expect(buttonNamed(checklist, "Run Playwright")).toBeUndefined();
    expect(checklist.querySelectorAll(".qa-auto-badge").length).toBeGreaterThan(0);
  });
});

describe("QA Studio — Run Playwright", () => {
  it.each<[AppRole, boolean]>([
    ["qa", true],
    ["lead", true],
    ["admin", true],
    ["member", false],
  ])("is offered to %s: %s", async (role, offered) => {
    setup(runAs(role, { items: ITEMS, automation: NOTHING_YET }));
    const container = await studio(role);
    expect(Boolean(buttonNamed(container, "Run Playwright"))).toBe(offered);
  });

  it("is disabled on a signed-off run, with the reason", async () => {
    setup(
      runAs("qa", {
        items: ITEMS,
        automation: NOTHING_YET,
        status: "signed_off",
        signoff: {
          id: "so-1",
          verdict: "APPROVED",
          summary: null,
          conditions: null,
          signedBy: { id: "u", login: "ana" },
          signedAt: "2026-09-25T06:00:00.000Z",
        },
      }),
    );
    const container = await studio("qa");
    const button = buttonNamed(container, "Run Playwright");
    expect(button?.disabled).toBe(true);
    const reason = container.querySelector(".qa-auto__reason");
    expect(reason?.textContent).toMatch(/signed off/);
    expect(button?.getAttribute("aria-describedby")).toBe(reason?.id);
  });

  it("confirms in a live region and warns when the branch moved", async () => {
    setup(runAs("qa", { items: ITEMS, automation: NOTHING_YET }));
    runs.dispatchAutomation.mockResolvedValue({ workflowFile: "verify.yml", ref: "main", headSha: "9f8e7d6c5b4a", targetsRunCommit: false });
    const container = await studio("qa");
    const live = container.querySelector('.qa-auto__live[role="status"]');
    expect(live?.textContent).toBe("");
    await clickAsync(buttonNamed(container, "Run Playwright"));
    expect(runs.dispatchAutomation).toHaveBeenCalledWith("project-1", "run-1");
    expect(live?.textContent).toContain("Playwright started on main. Results appear here when the run reports.");
    expect(live?.textContent).toContain("Checking every 20 seconds.");
    expect(live?.querySelector(".qa-auto__warning")?.textContent).toBe(
      "The branch has moved to 9f8e7d6 — results will attach to that commit, not this run's abc1234.",
    );
    expect(buttonNamed(container, "Run Playwright again")).toBeDefined();
  });

  it("shows no warning when the workflow targets the run's commit", async () => {
    setup(runAs("qa", { items: ITEMS, automation: NOTHING_YET }));
    runs.dispatchAutomation.mockResolvedValue({ ref: "main", headSha: "abc1234def5678", targetsRunCommit: true });
    const container = await studio("qa");
    await clickAsync(buttonNamed(container, "Run Playwright"));
    expect(container.querySelector(".qa-auto__warning")).toBeNull();
  });

  it("offers Sign in again when GitHub needs re-authorising", async () => {
    setup(runAs("qa", { items: ITEMS, automation: NOTHING_YET }));
    runs.dispatchAutomation.mockRejectedValue(new ApiError("x", 409, { code: "GITHUB_REAUTH" }));
    const container = await studio("qa");
    await clickAsync(buttonNamed(container, "Run Playwright"));
    const alert = container.querySelector('.qa-auto__error[role="alert"]');
    expect(alert?.textContent).toMatch(/sign in again/i);
    expect(alert?.querySelector("a")?.getAttribute("href")).toBe("/login?next=/projects/project-1");
    click(buttonNamed(alert!, "Dismiss"));
    expect(container.querySelector(".qa-auto__error")).toBeNull();
  });

  it("explains a missing verify workflow without a sign-in link", async () => {
    setup(runAs("qa", { items: ITEMS, automation: NOTHING_YET }));
    runs.dispatchAutomation.mockRejectedValue(new ApiError("x", 409, { code: "VERIFY_WORKFLOW_MISSING" }));
    const container = await studio("qa");
    await clickAsync(buttonNamed(container, "Run Playwright"));
    const alert = container.querySelector(".qa-auto__error");
    expect(alert?.textContent).toMatch(/no verify workflow/);
    expect(alert?.querySelector("a")).toBeNull();
  });
});

describe("QA report — automated results", () => {
  async function report(value: QaReport) {
    return render(<QaReportDocument report={value} />);
  }

  function section(container: HTMLElement): HTMLElement {
    return container.querySelector<HTMLElement>('[aria-labelledby="qa-report-automated"]')!;
  }

  function withAutomatedItems(overrides: Partial<QaReport> = {}): QaReport {
    const base = frozenReport();
    const items = base.run.items.map((item, index) =>
      index === 0 ? { ...item, automated: automated({ status: "passed", failure: null }) } : item,
    );
    return { ...base, run: { ...base.run, items }, ...overrides };
  }

  it("marks an inferred pass as not confirmed in the checklist table", async () => {
    const base = frozenReport();
    const items = base.run.items.map((item, index) =>
      index === 0 ? { ...item, automated: automated({ status: "passed", failure: null, inferred: true }) } : item,
    );
    const container = await report({ ...base, run: { ...base.run, items } });
    expect(container.querySelector(".qa-auto-badge")?.textContent).toBe("AutomatedPassed (not confirmed)");
  });

  it("keeps Not available yet when the report has no automated results", async () => {
    const container = await report(frozenReport({ automatedResults: null }));
    expect(section(container).textContent).toContain("Not available yet");
    expect(section(container).querySelector("table")).toBeNull();
  });

  it("keeps Not available yet for a report frozen before the field existed", async () => {
    const legacy = frozenReport();
    delete (legacy as Partial<QaReport>).automatedResults;
    const container = await report(legacy);
    expect(section(container).textContent).toContain("Not available yet");
    expect(container.querySelector(".qa-auto-badge")).toBeNull();
  });

  it("says nothing was reported when the object is there but empty", async () => {
    const container = await report(frozenReport({ automatedResults: {} }));
    expect(section(container).textContent).toContain("No results reported");
    expect(section(container).textContent).toContain("feat/checkout @ a1b2c3d");
  });

  it("renders the per-stage table and each stage's failures", async () => {
    const truncated = qualitySuccess({
      status: "failure",
      tests: {
        total: 50,
        passed: 45,
        failed: 5,
        failures: [{ name: "cart-total › coupon", message: "expected 2480" }],
        failuresTruncated: true,
      },
    });
    const container = await report(withAutomatedItems({ automatedResults: { verify: verifyFailure(), quality: truncated } }));
    const table = section(container).querySelector("table")!;
    expect([...table.querySelectorAll("thead th")].map((node) => node.textContent)).toEqual([
      "Stage",
      "Status",
      "Tests passed",
      "Reported",
    ]);
    const rows = [...table.querySelectorAll("tbody tr")];
    expect(rows[0].textContent).toContain("Verify");
    expect(rows[0].textContent).toContain("browser & API tests");
    expect(rows[0].textContent).toContain("Failed");
    expect(rows[0].textContent).toContain("18 / 20");
    expect(rows[0].textContent).toContain("2 failed");
    // The cell renders in the viewer's own zone, so derive the expectation from
    // the same rule rather than hard-coding a date: 06:57Z is still 09-24 at
    // UTC-7 and further west, and lands on :27 in half-hour zones (UTC+5:30).
    // The rule itself is pinned to explicit zones in qa-report-rules.test.ts.
    expect(rows[0].textContent).toContain(formatReportDate(verifyFailure().reportedAt));
    expect(rows[1].textContent).toContain("Quality");
    expect(rows[1].textContent).toContain("45 / 50");
    const failures = [...section(container).querySelectorAll(".qa-report-auto__failures")];
    expect(failures).toHaveLength(2);
    expect(failures[0].textContent).toContain("Verify failures (2 listed)");
    expect(failures[0].textContent).toContain("e2e/checkout.spec.ts › pays with a saved card");
    expect(failures[1].querySelector(".qa-report-auto__note")?.textContent).toBe("4 more failures not listed.");
  });

  it("marks a stage that has not reported", async () => {
    const container = await report(withAutomatedItems({ automatedResults: { verify: verifyFailure(), quality: null } }));
    const rows = [...section(container).querySelectorAll("tbody tr")];
    expect(rows[1].textContent).toContain("Not reported");
  });

  it("shows the Automated badge beside the status for automated items only", async () => {
    const container = await report(withAutomatedItems({ automatedResults: automation() }));
    const rows = [...container.querySelectorAll('[aria-labelledby="qa-report-checklist"] tbody tr')];
    expect(rows[0].querySelector(".qa-auto-badge")?.textContent).toBe("AutomatedPassed");
    expect(rows[0].querySelector(".qa-report-auto-cell")?.textContent).toContain("This spec");
    expect(rows[1].querySelector(".qa-auto-badge")).toBeNull();
    expect(rows[0].querySelector(".qa-pill")?.textContent).toBe("Passed");
  });
});
