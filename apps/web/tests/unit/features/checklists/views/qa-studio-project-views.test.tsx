import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { checklistsRepository } from "../../../../../src/features/checklists/data/checklists-repository";
import { qaRunsRepository } from "../../../../../src/features/checklists/data/qa-runs-repository";
import { projectsRepository } from "../../../../../src/features/projects/data/projects-repository";
import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { normalizeProjectRunCurrent } from "../../../../../src/features/checklists/model/project-run-rules";
import type { QaScope } from "../../../../../src/features/checklists/model/qa-scope";
import { QaStudioPanel } from "../../../../../src/features/checklists/studio/views/qa-studio-panel";
import type { QaRun } from "../../../../../src/features/checklists/model/qa-run-types";
import type { AppRole, ProjectBranchPreview } from "../../../../../src/shared/api/contracts";
import { checklist } from "../checklist-fixtures";
import { apiErrorWith, promotionWire } from "../qa-promotion-fixtures";

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
    promotion: jest.fn(),
    mergePromotion: jest.fn(),
  },
}));
jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: { current: jest.fn(), start: jest.fn(), setVerification: jest.fn(), signoff: jest.fn(), reopen: jest.fn(), acceptItem: jest.fn() },
}));
jest.mock("../../../../../src/features/projects/data/projects-repository", () => ({
  projectsRepository: { previews: jest.fn() },
}));

const checklists = checklistsRepository as jest.Mocked<typeof checklistsRepository>;
const runs = qaRunsRepository as jest.Mocked<typeof qaRunsRepository>;
const projects = projectsRepository as jest.Mocked<typeof projectsRepository>;
const projectRuns = projectQaRunsRepository as jest.Mocked<typeof projectQaRunsRepository>;

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

function setup(promotion: unknown, run: QaRun | null = null) {
  projects.previews.mockResolvedValue({ enabled: true, liveProvidersEnabled: true, providerError: null, branches: [PREVIEW] });
  checklists.listForProject.mockResolvedValue({ items: [checklist()], canManage: false });
  runs.current.mockResolvedValue({ commitSha: "9f8e7d6c5b4a", commitSource: "deployment", run });
  runs.promotion.mockResolvedValue(promotion as never);
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
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function studio(
  role: AppRole,
  qaScope?: QaScope,
  po?: Record<string, never>,
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
        qaScope={qaScope}
        studio={po ? "po" : undefined}
      />,
    );
  });
  await settle();
  return container;
}

/** The readiness chip's popover (hidden until the chip is pressed). */
function readiness(container: HTMLElement): { chip: HTMLButtonElement; popover: HTMLElement } {
  const chip = container.querySelector<HTMLButtonElement>("button.qa-promo-chip");
  if (!chip) throw new Error("no readiness chip");
  return { chip, popover: document.getElementById(chip.getAttribute("aria-controls")!)! };
}

async function click(element: Element | null | undefined) {
  if (!element) throw new Error("nothing to click");
  await act(async () => {
    (element as HTMLElement).click();
  });
  await settle();
}

import { headWire, projectRunWire, runItemWire, SHA_BE, SHA_BE_NEW } from "../requirement-fixtures";

const PROJECT_SCOPE: QaScope = { kind: "project", deliveryProjectId: "dp-1", projectName: "storefront", projectHref: null };

function projectGate(overrides: Record<string, unknown> = {}) {
  return promotionWire({
    scope: "project",
    deliveryProject: { id: "dp-1", name: "storefront" },
    run: { id: "prun-1", verdict: "APPROVED", signedAt: "2026-10-01T10:00:00Z", stale: true },
    repositories: [
      headWire(),
      headWire({ projectId: "proj-be", repoFullName: "tone/orders-api", runSha: SHA_BE, currentSha: SHA_BE_NEW, moved: true }),
    ],
    reasons: ['Project run is stale: "orders-api" moved from e4f5a6b to ffffeee'],
    eligible: false,
    ...overrides,
  });
}

describe("QA Studio — Project-level QA", () => {
  it("verifies a repository filed under a Project on the Project's run, never a repository run", async () => {
    setup(projectGate());
    projectRuns.current.mockResolvedValue(normalizeProjectRunCurrent({ run: projectRunWire() }));
    const container = await studio("qa", PROJECT_SCOPE);
    expect(container.textContent).toContain("QA testing");
    expect(container.textContent).toContain("storefront");
    expect(container.querySelectorAll(".pqa-group")).toHaveLength(2);
    expect(runs.current).not.toHaveBeenCalled();
    expect(checklists.listForProject).not.toHaveBeenCalled();
  });

  it("shows the Project gate: the run, each repository's head and what blocks the merge", async () => {
    setup(projectGate());
    projectRuns.current.mockResolvedValue(normalizeProjectRunCurrent({ run: projectRunWire() }));
    const container = await studio("lead", PROJECT_SCOPE);
    const { chip, popover: section } = readiness(container);
    await click(chip);
    expect(section.hidden).toBe(false);
    expect(section.textContent).toContain("storefront QA testing");
    expect(section.textContent).toContain("Project run is stale: uat moved since sign-off");
    // A Product owner gets no per-repository head rows in the gate.
    expect(section.textContent).not.toContain("orders-api moved since this run (e4f5a6b → ffffeee)");
    // The server's per-repository reason, in Project words.
    expect(section.textContent).not.toContain('"orders-api" moved');
    expect(section.textContent).toContain("The Project's code on uat changed since QA signed it off.");
    expect(section.textContent).not.toContain("Release smoke test");
    expect(section.querySelector(".qa-promo__why")?.textContent).toMatch(/QA signs the Project off Approved on its current uat build/);
    const merge = container.querySelector<HTMLButtonElement>("button.qa-promo__merge")!;
    expect(document.getElementById(merge.getAttribute("aria-describedby")!)?.textContent).toMatch(/QA signs the Project off Approved on its current uat build/);
  });

  it("falls back to the repository run when the server has no Project runs", async () => {
    setup(promotionWire());
    projectRuns.current.mockRejectedValue(apiErrorWith(404));
    const container = await studio("qa", PROJECT_SCOPE);
    expect(runs.current).toHaveBeenCalled();
    expect(container.textContent).toContain("Release smoke test");
  });

  it("blocks an unfiled repository and keeps its old runs as history", async () => {
    setup(projectGate({ scope: "unfiled", deliveryProject: null, run: null, repositories: [], reasons: [] }));
    const container = await studio("lead");
    expect(container.textContent).toContain("This repository is not filed under a Project");
    expect(container.textContent).toContain("Not filed under a Project");
    expect(container.textContent).not.toContain("Start QA run on uat");
    expect(container.textContent).toContain("No new repository runs");
  });

  it("asks for a run on the moved heads when uat moved since the latest Project run", async () => {
    setup(projectGate());
    projectRuns.current.mockResolvedValue(
      normalizeProjectRunCurrent({
        run: null,
        stale: true,
        heads: [headWire({ projectId: "proj-be", repoFullName: "tone/orders-api", runSha: SHA_BE, currentSha: SHA_BE_NEW, moved: true })],
      }),
    );
    const container = await studio("qa", PROJECT_SCOPE);
    expect(container.textContent).toContain("uat changed since the latest Project run");
    // The QA Team sees the Project: one sentence, no repository or commit.
    expect(container.textContent).toContain("The Project's code on uat changed since this run started.");
    expect(container.textContent).not.toContain("orders-api");
    expect(container.textContent).toContain("Start QA testing");
  });
});

const SIGNED_APPROVED = {
  status: "signed_off",
  signoff: { id: "s1", verdict: "APPROVED", summary: null, conditions: null, signedBy: { id: "u", login: "ana-qa" }, signedAt: "2026-10-01T10:00:00Z" },
  permissions: { canSetVerification: false, canSignOff: false, canReopen: true, canDispatch: false, canAccept: true },
};

const PASSED_ITEMS = [
  runItemWire({ status: "passed" }),
  runItemWire({ id: "run-item-2", position: 1, title: "As a shopper, I see my receipt", status: "passed" }),
];

function accepted(id: string) {
  return { status: "passed", acceptedBy: { id: "po-1", login: "pia-po" }, acceptedAt: "2026-10-02T09:00:00Z", id };
}

function buttonNamed(container: ParentNode, name: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((button) => button.textContent?.trim() === name);
}

function typeInto(field: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value")!.set!;
  act(() => {
    setter.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/* PO Studio: QA Studio's shell for a Product owner — the same uat preview,
 * with the Product owner's own check of QA's run and the merge to main. */
describe("PO Studio", () => {
  it("waits for QA's sign-off, showing QA's run item by item with nothing to decide yet", async () => {
    setup(projectGate({ run: null, reasons: ["The Project has no signed-off QA run yet."] }));
    projectRuns.current.mockResolvedValue(
      normalizeProjectRunCurrent({ run: projectRunWire({ items: [runItemWire({ status: "passed" }), runItemWire({ id: "run-item-2", position: 1 })] }) }),
    );
    const container = await studio("lead", PROJECT_SCOPE, {});

    const panel = container.querySelector("[role='tabpanel']");
    expect(panel?.id).toBe("project-detail-panel-po");
    expect(panel?.getAttribute("aria-labelledby")).toBe("project-detail-tab-po");
    const status = container.querySelector(".po-accept__status");
    expect(status?.textContent).toContain("Waiting for QA sign-off");
    expect(status?.textContent).toContain("1 of 2 items passed, 1 still with QA.");
    // The preview is the same uat deployment QA tests.
    expect(container.querySelector(".qa-device__frame")?.getAttribute("src")).toBe("https://shop.example.com/");

    // Every item, open, with QA's verdict; no decision before QA signs off, and no QA control.
    const items = [...container.querySelectorAll(".po-check__item")];
    expect(items.map((item) => item.getAttribute("data-status"))).toEqual(["passed", "pending"]);
    expect(container.querySelector(".po-check__count")?.textContent).toBe("0 of 2 passed by you");
    expect(container.querySelector(".po-check__pass, .po-check__fail")).toBeNull();
    expect(container.querySelector(".po-check select, .pqa-verify, .qa-run-item")).toBeNull();
    // No sign-off banner and no "Delivery to main" section in the panel.
    expect(container.querySelector(".qa-signoff-banner")).toBeNull();
    expect(container.textContent).not.toContain("Delivery to main");
  });

  it("shows why QA sent an item back", async () => {
    setup(projectGate({ run: null, reasons: ["The Project has no signed-off QA run yet."] }));
    projectRuns.current.mockResolvedValue(
      normalizeProjectRunCurrent({
        run: projectRunWire({
          items: [
            runItemWire({
              status: "returned_to_dev",
              defectSeverity: "major",
              notes: "Card declined",
              verifiedBy: { id: "u", login: "ana-qa" },
            }),
          ],
        }),
      }),
    );
    const container = await studio("lead", PROJECT_SCOPE, {});
    const item = container.querySelector(".po-check__item");
    expect(item?.querySelector(".qa-severity")).not.toBeNull();
    expect(item?.textContent).toContain("Returned by @ana-qa");
    expect(item?.textContent).toContain("Card declined");
  });

  it("after QA's Approved sign-off, the Product owner passes each item, and the readiness is read again", async () => {
    setup(projectGate({ run: { id: "prun-1", verdict: "APPROVED", signedAt: "2026-10-01T10:00:00Z", stale: false }, repositories: [headWire()], reasons: ["2 items are waiting for the Product owner to pass them"] }));
    projectRuns.current.mockResolvedValue(normalizeProjectRunCurrent({ run: projectRunWire({ ...SIGNED_APPROVED, items: PASSED_ITEMS }) }));
    const container = await studio("lead", PROJECT_SCOPE, {});

    const status = container.querySelector(".po-accept__status");
    expect(status?.textContent).toContain("Waiting for your check");
    expect(status?.textContent).toContain("2 items are still waiting for you");
    // The sign-off banner, Reopen and "Delivery to main" are gone from the panel.
    expect(container.querySelector(".qa-signoff-banner")).toBeNull();
    expect(buttonNamed(container, "Reopen run")).toBeUndefined();
    expect(container.textContent).not.toContain("Delivery to main");

    const reply = projectRunWire({
      ...SIGNED_APPROVED,
      items: [
        runItemWire({ status: "passed", rowVersion: 2, poAcceptance: accepted("run-item-1") }),
        PASSED_ITEMS[1],
      ],
    });
    projectRuns.acceptItem.mockResolvedValue(normalizeProjectRunCurrent({ run: reply }).run);
    const promotionReads = runs.promotion.mock.calls.length;
    await click(buttonNamed(container.querySelectorAll(".po-check__item")[0]!, "Pass"));

    expect(projectRuns.acceptItem).toHaveBeenCalledWith("dp-1", "prun-1", "run-item-1", {
      decision: "passed",
      expectedRowVersion: 1,
    });
    const first = container.querySelectorAll(".po-check__item")[0]!;
    expect(first.getAttribute("data-accepted")).toBe("passed");
    expect(first.textContent).toContain("Passed by @pia-po");
    expect(buttonNamed(first, "Pass")).toBeUndefined();
    expect(container.querySelector(".po-check__count")?.textContent).toBe("1 of 2 passed by you");
    expect(runs.promotion.mock.calls.length).toBeGreaterThan(promotionReads);
  });

  it("fails an item with what is wrong: the run is reopened and the story goes back to the Developers", async () => {
    setup(projectGate({ run: { id: "prun-1", verdict: "APPROVED", signedAt: "2026-10-01T10:00:00Z", stale: false }, repositories: [headWire()], reasons: ["2 items are waiting for the Product owner to pass them"] }));
    projectRuns.current.mockResolvedValue(normalizeProjectRunCurrent({ run: projectRunWire({ ...SIGNED_APPROVED, items: PASSED_ITEMS }) }));
    const container = await studio("lead", PROJECT_SCOPE, {});

    const first = () => container.querySelectorAll(".po-check__item")[0]!;
    await click(buttonNamed(first(), "Fail"));
    const form = first().querySelector<HTMLFormElement>("form.po-check__fail-form")!;
    expect(form.textContent).toContain("sends this story back to the Developers");
    await act(async () => form.requestSubmit());
    expect(form.querySelector("[role='alert']")?.textContent).toBe("Say what is wrong, so the Developers know what to fix.");
    expect(projectRuns.acceptItem).not.toHaveBeenCalled();

    const reopened = projectRunWire({
      status: "open",
      signoff: null,
      permissions: { canSetVerification: true, canSignOff: true, canReopen: false, canDispatch: true, canAccept: false },
      items: [
        runItemWire({ status: "failed", rowVersion: 2, defectSeverity: "major", notes: "Product owner: Header is empty", progress: "in_progress" }),
        PASSED_ITEMS[1],
      ],
    });
    projectRuns.acceptItem.mockResolvedValue(normalizeProjectRunCurrent({ run: reopened }).run);
    typeInto(form.querySelector("textarea")!, "Header is empty");
    await act(async () => form.requestSubmit());
    await settle();

    expect(projectRuns.acceptItem).toHaveBeenCalledWith("dp-1", "prun-1", "run-item-1", {
      decision: "failed",
      notes: "Header is empty",
      defectSeverity: "major",
      expectedRowVersion: 1,
    });
    expect(first().getAttribute("data-status")).toBe("failed");
    expect(first().textContent).toContain("Product owner: Header is empty");
    expect(container.querySelector(".po-check__pass, .po-check__fail, form.po-check__fail-form")).toBeNull();
    expect(container.querySelector(".po-accept__status")?.textContent).toContain("Waiting for QA sign-off");
  });

  it("is ready once every item is passed: no status box, and Merge to main", async () => {
    setup(projectGate({ eligible: true, reasons: [], repositories: [headWire()], run: { id: "prun-1", verdict: "APPROVED", signedAt: "2026-10-01T10:00:00Z", stale: false } }));
    projectRuns.current.mockResolvedValue(
      normalizeProjectRunCurrent({
        run: projectRunWire({
          ...SIGNED_APPROVED,
          items: [
            runItemWire({ status: "passed", poAcceptance: accepted("run-item-1") }),
            runItemWire({ id: "run-item-2", position: 1, status: "passed", poAcceptance: accepted("run-item-2") }),
          ],
        }),
      }),
    );
    const container = await studio("lead", PROJECT_SCOPE, {});

    expect(container.querySelector(".po-accept")?.getAttribute("data-state")).toBe("ready");
    expect(container.querySelector(".po-accept__status")).toBeNull();
    expect(container.querySelector(".po-check__count")?.textContent).toBe("2 of 2 passed by you");
    expect([...container.querySelectorAll("button")].some((button) => button.textContent?.includes("Merge to main"))).toBe(true);
  });

  it("keeps its Acceptance in a rail with its own pin, remembered apart from QA Studio's", async () => {
    setup(projectGate({ run: null, reasons: ["The Project has no signed-off QA run yet."] }));
    projectRuns.current.mockResolvedValue(normalizeProjectRunCurrent({ run: projectRunWire({ items: [runItemWire()] }) }));
    const container = await studio("lead", PROJECT_SCOPE, {});
    const studioRoot = container.querySelector(".qa-studio")!;
    expect(studioRoot.getAttribute("data-rail")).toBe("collapsed");
    expect(container.querySelector(".qa-drawer__title")?.textContent).toBe("Acceptance");
    expect(container.querySelector(".qa-rail__summary")?.getAttribute("title")).toMatch(/^Acceptance/);

    await click(container.querySelector('button[aria-label="Keep Acceptance open"]'));
    expect(studioRoot.getAttribute("data-rail")).toBe("pinned");
    expect(window.localStorage.getItem("alphaci.po-studio.rail-pinned")).toBe("1");
    expect(window.localStorage.getItem("alphaci.qa-studio.rail-pinned")).toBeNull();
  });

  it("tells a Product owner an unfiled repository has nothing to accept", async () => {
    setup(projectGate({ scope: "unfiled", deliveryProject: null, run: null, repositories: [], reasons: [] }));
    projectRuns.current.mockResolvedValue(normalizeProjectRunCurrent({ run: null }));
    const container = await studio("lead", { kind: "repository" }, {});
    // Not filed under a Project: the legacy run column, as QA Studio shows it.
    expect(container.textContent).toContain("This repository is not filed under a Project");
    expect(container.querySelector(".po-accept")).toBeNull();
  });
});
