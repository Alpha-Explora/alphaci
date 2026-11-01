import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { getProjectBrowserTests } from "../../../../../../src/features/projects/detail/data/project-browser-tests-api";
import { getProjectVisualChecks } from "../../../../../../src/features/projects/detail/data/project-visual-api";
import { studioVisualSummary, visualNeedsReview } from "../../../../../../src/features/projects/detail/model/visual-check-rules";
import type { VisualChecksResponse, VisualSnapshot } from "../../../../../../src/features/projects/detail/model/visual-check-types";
import {
  studioChecksRenderer,
  VISUAL_REVIEW_ELSEWHERE,
} from "../../../../../../src/features/projects/detail/views/studio-repository-checks";
import type { ProjectDetailTab } from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";

jest.mock("../../../../../../src/features/projects/detail/data/project-browser-tests-api", () => ({
  getProjectBrowserTests: jest.fn(),
  addProjectBrowserTests: jest.fn(),
}));
jest.mock("../../../../../../src/features/projects/detail/data/project-visual-api", () => ({
  getProjectVisualChecks: jest.fn(),
  approveProjectVisualChecks: jest.fn(),
}));

const browserTests = getProjectBrowserTests as jest.MockedFunction<typeof getProjectBrowserTests>;
const visual = getProjectVisualChecks as jest.MockedFunction<typeof getProjectVisualChecks>;

function snapshot(name: string, status: VisualSnapshot["status"]): VisualSnapshot {
  return { name, status, baselineUrl: null, actualUrl: null, diffUrl: null, baselineApprovedBy: null, baselineApprovedAt: null, inheritedFrom: null, approved: false };
}

function checks(snapshots: VisualSnapshot[]): VisualChecksResponse {
  return { branch: "uat", runId: 77, commitSha: "a1b2c3d", reportedAt: "2026-10-07T08:00:00Z", browser: "chromium", canApprove: false, snapshots };
}

const CHANGED = checks([snapshot("home.png", "changed"), snapshot("cart.png", "changed"), snapshot("about.png", "new"), snapshot("faq.png", "passed")]);

describe("studio visual summary", () => {
  it("says what changed on uat, or that nothing did, or that nothing was captured", () => {
    expect(studioVisualSummary(CHANGED, "uat")).toBe("Visual: 2 changed · 1 new");
    expect(studioVisualSummary(checks([snapshot("a.png", "passed")]), "uat")).toBe("Visual: no changes");
    expect(studioVisualSummary(checks([]), "uat")).toBe("Visual: no screenshots captured");
    expect(studioVisualSummary({ branch: "uat", runId: null, canApprove: false, snapshots: [] }, "uat")).toBe("Visual: not captured on uat yet");
    expect(studioVisualSummary(null, "uat")).toBe("Visual: not captured on uat yet");
  });

  it("asks for a review only when something changed or is new", () => {
    expect(visualNeedsReview(CHANGED)).toBe(true);
    expect(visualNeedsReview(checks([snapshot("a.png", "passed")]))).toBe(false);
    expect(visualNeedsReview(null)).toBe(false);
  });
});

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

async function render(
  repository: { projectId: string; repoFullName: string },
  visibleTabs: ProjectDetailTab[],
  openPipeline = jest.fn(),
  workflowUpdateAccess: "open" | "role" | "unavailable" = "open",
) {
  const render = studioChecksRenderer("project-1", { visibleTabs, openPipeline, openPullRequest: jest.fn(), workflowUpdateAccess });
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<>{render(repository)}</>);
  });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  return container;
}

const ADMIN_TABS: ProjectDetailTab[] = ["overview", "pulls", "pipeline", "qa"];
const QA_TABS: ProjectDetailTab[] = ["overview", "checklists", "qa", "audit", "settings"];
const WEB = { projectId: "project-1", repoFullName: "tone/storefront-web" };
const API = { projectId: "project-2", repoFullName: "tone/orders-api" };

describe("StudioRepositoryChecks", () => {
  beforeEach(() => {
    browserTests.mockResolvedValue({
      installed: true, branch: "dev", missingFiles: [], presentFiles: [], hasLockfile: true, playwrightVersion: "1.56.0", frontend: true, canAdd: false, reason: null,
    });
  });

  it("reads uat's latest screenshots for the repository it is given", async () => {
    visual.mockResolvedValue(CHANGED);
    await render(API, ADMIN_TABS);
    expect(visual).toHaveBeenCalledWith("project-2", "uat", null);
    expect(browserTests).toHaveBeenCalledWith("project-2");
  });

  it("opens this page's Pipeline tab on Runs for its own repository", async () => {
    visual.mockResolvedValue(CHANGED);
    const openPipeline = jest.fn();
    const container = await render(WEB, ADMIN_TABS, openPipeline);
    expect(container.querySelector(".studio-checks__summary")?.textContent).toBe("Visual: 2 changed · 1 new");
    const link = container.querySelector<HTMLButtonElement>("button.studio-checks__link")!;
    expect(link.textContent).toBe("Review in Pipeline");
    act(() => link.click());
    expect(openPipeline).toHaveBeenCalledWith("runs");
  });

  it("links another repository's Pipeline tab inside the product, never GitHub", async () => {
    visual.mockResolvedValue(CHANGED);
    const container = await render(API, ADMIN_TABS);
    const link = container.querySelector<HTMLAnchorElement>("a.studio-checks__link")!;
    expect(link.getAttribute("href")).toBe("/projects/project-2#pipeline");
    expect(container.innerHTML).not.toMatch(/github\.com/);
  });

  it("tells a viewer without the Pipeline tab who reviews the change, instead of a link", async () => {
    visual.mockResolvedValue(CHANGED);
    const container = await render(WEB, QA_TABS);
    expect(container.querySelector(".studio-checks__link")).toBeNull();
    expect(container.querySelector(".studio-checks__note")?.textContent).toBe(VISUAL_REVIEW_ELSEWHERE);
  });

  it("leaves the line out when the screenshots could not be read", async () => {
    visual.mockRejectedValue(new Error("down"));
    const container = await render(WEB, ADMIN_TABS);
    expect(container.querySelector(".studio-checks__visual")).toBeNull();
  });

  it("offers Add browser tests only when the repository lacks them", async () => {
    visual.mockResolvedValue(checks([]));
    browserTests.mockResolvedValue({
      installed: false, branch: "dev", missingFiles: ["tests/e2e/a11y.e2e-spec.ts"], presentFiles: [], hasLockfile: true, playwrightVersion: null, frontend: true, canAdd: true, reason: null,
    });
    let container = await render(WEB, ADMIN_TABS);
    expect(container.querySelector("[data-browser-tests]")?.textContent).toContain("Accessibility");
    expect([...container.querySelectorAll("button")].some((button) => button.textContent === "Add browser tests")).toBe(true);
    act(() => root?.unmount());
    root = null;
    browserTests.mockResolvedValue({
      installed: true, branch: "dev", missingFiles: [], presentFiles: [], hasLockfile: true, playwrightVersion: null, frontend: true, canAdd: false, reason: null,
    });
    container = await render(WEB, ADMIN_TABS);
    expect(container.querySelector("[data-browser-tests]")).toBeNull();
  });
});

describe("StudioRepositoryChecks — visual testing off in the workflow", () => {
  const INSTALLED = {
    installed: true, branch: "dev", missingFiles: [], presentFiles: [], hasLockfile: true, playwrightVersion: "1.56.0", frontend: true, canAdd: false, reason: null,
  };
  const NOT_CAPTURED: VisualChecksResponse = { branch: "uat", runId: null, canApprove: false, snapshots: [] };

  it("says off for this repo instead of not captured yet, and how to turn it on", async () => {
    visual.mockResolvedValue(NOT_CAPTURED);
    browserTests.mockResolvedValue({ ...INSTALLED, visual: { dev: false, uat: false } });
    const openPipeline = jest.fn();
    const container = await render(WEB, ADMIN_TABS, openPipeline);
    expect(container.querySelector(".studio-checks__summary")?.textContent).toBe("Visual: off for this repo");
    expect(container.querySelector("[data-visual-off]")?.textContent).toContain(
      "Visual testing is off in this repository's workflow.",
    );
    const update = [...container.querySelectorAll("button")].find((button) => button.textContent === "Update the workflow");
    act(() => update!.click());
    expect(openPipeline).toHaveBeenCalledWith("configuration");
    expect(browserTests).toHaveBeenCalledTimes(1);
  });

  it("tells a QA viewer who can turn it on", async () => {
    visual.mockResolvedValue(NOT_CAPTURED);
    browserTests.mockResolvedValue({ ...INSTALLED, visual: { dev: false, uat: false } });
    const container = await render(WEB, QA_TABS, jest.fn(), "role");
    expect(container.querySelector("[data-visual-off] .pipe-tests__reason")?.textContent).toBe(
      "A Developer, Product owner or admin can open the workflow update pull request.",
    );
  });

  it("links another repository's Pipeline configuration (#workflow) inside the product", async () => {
    visual.mockResolvedValue(NOT_CAPTURED);
    browserTests.mockResolvedValue({ ...INSTALLED, visual: { dev: false, uat: false } });
    const container = await render(API, ADMIN_TABS);
    expect(container.querySelector<HTMLAnchorElement>("[data-visual-off] a")?.getAttribute("href")).toBe("/projects/project-2#workflow");
    expect(container.innerHTML).not.toMatch(/github\.com/);
  });

  it("keeps not captured yet for an older backend, and when visual is on", async () => {
    visual.mockResolvedValue(NOT_CAPTURED);
    browserTests.mockResolvedValue(INSTALLED);
    let container = await render(WEB, ADMIN_TABS);
    expect(container.querySelector(".studio-checks__summary")?.textContent).toBe("Visual: not captured on uat yet");
    expect(container.querySelector("[data-browser-tests]")).toBeNull();
    act(() => root?.unmount());
    root = null;
    browserTests.mockResolvedValue({ ...INSTALLED, visual: { dev: true, uat: true } });
    container = await render(WEB, ADMIN_TABS);
    expect(container.querySelector(".studio-checks__summary")?.textContent).toBe("Visual: not captured on uat yet");
  });

  it("keeps not captured yet when the status could not be read", async () => {
    visual.mockResolvedValue(NOT_CAPTURED);
    browserTests.mockRejectedValue(new Error("down"));
    const container = await render(WEB, ADMIN_TABS);
    expect(container.querySelector(".studio-checks__summary")?.textContent).toBe("Visual: not captured on uat yet");
  });

  it("says to promote when only uat is off", async () => {
    visual.mockResolvedValue(NOT_CAPTURED);
    browserTests.mockResolvedValue({ ...INSTALLED, visual: { dev: true, uat: false } });
    const container = await render(WEB, ADMIN_TABS);
    expect(container.querySelector(".studio-checks__summary")?.textContent).toBe("Visual: off for this repo");
    expect(container.querySelector("[data-visual-off]")?.textContent).toContain(
      "Turned on in dev. Promote to uat to start capturing screenshots.",
    );
  });
});
