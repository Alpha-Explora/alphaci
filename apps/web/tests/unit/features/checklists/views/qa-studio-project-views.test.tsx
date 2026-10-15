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
  projectQaRunsRepository: { current: jest.fn(), start: jest.fn(), setVerification: jest.fn(), signoff: jest.fn(), reopen: jest.fn() },
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
  po?: { onOpenQaRun?: () => void },
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
        onOpenQaRun={po?.onOpenQaRun}
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
  permissions: { canSetVerification: false, canSignOff: false, canReopen: true, canDispatch: false },
};

/* PO Studio: QA Studio's shell for a Product owner — the same uat preview,
 * with acceptance and the merge to main in the column. */
describe("PO Studio", () => {
  it("stays locked while QA has not signed off, and points at the QA run", async () => {
    setup(projectGate({ run: null, reasons: ["The Project has no signed-off QA run yet."] }));
    projectRuns.current.mockResolvedValue(
      normalizeProjectRunCurrent({ run: projectRunWire({ items: [runItemWire({ status: "passed" }), runItemWire({ id: "run-item-2", position: 1 })] }) }),
    );
    const onOpenQaRun = jest.fn();
    const container = await studio("lead", PROJECT_SCOPE, { onOpenQaRun });

    const panel = container.querySelector("[role='tabpanel']");
    expect(panel?.id).toBe("project-detail-panel-po");
    expect(panel?.getAttribute("aria-labelledby")).toBe("project-detail-tab-po");
    const status = container.querySelector(".po-accept__status");
    expect(status?.textContent).toContain("Waiting for QA sign-off");
    expect(status?.textContent).toContain("1 of 2 items passed, 1 still with QA.");
    // Acceptance, not verification: no item controls, no sign-off form here.
    expect(container.querySelector(".qa-run-item")).toBeNull();
    expect(container.querySelector(".pqa-verify, .qa-status-select")).toBeNull();
    // The preview is the same uat deployment QA tests.
    expect(container.querySelector(".qa-device__frame")?.getAttribute("src")).toBe("https://shop.example.com/");

    const open = [...container.querySelectorAll("button")].find((button) => button.textContent === "View the QA run");
    await click(open);
    expect(onOpenQaRun).toHaveBeenCalledTimes(1);
  });

  it("unlocks once QA signed off Approved: who signed, Reopen, and Merge to main", async () => {
    setup(projectGate({ eligible: true, reasons: [], run: { id: "prun-1", verdict: "APPROVED", signedAt: "2026-10-01T10:00:00Z", stale: false } }));
    projectRuns.current.mockResolvedValue(normalizeProjectRunCurrent({ run: projectRunWire(SIGNED_APPROVED) }));
    const container = await studio("lead", PROJECT_SCOPE, {});

    expect(container.querySelector(".po-accept")?.getAttribute("data-state")).toBe("ready");
    expect(container.querySelector(".po-accept__status")?.textContent).toContain("Ready for production");
    expect(container.querySelector(".qa-signoff-banner")?.textContent).toContain("@ana-qa");
    expect([...container.querySelectorAll("button")].some((button) => button.textContent === "Reopen run")).toBe(true);
    expect([...container.querySelectorAll("button")].some((button) => button.textContent?.includes("Merge to main"))).toBe(true);
    expect(container.textContent).not.toContain("View the QA run");
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
