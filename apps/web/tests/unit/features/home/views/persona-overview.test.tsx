import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { PersonaOverview } from "../../../../../src/features/home/dashboard/views/persona-overview";
import { homeLayoutFor } from "../../../../../src/features/home/model/home-layout-rules";
import { buildPersonaDashboard } from "../../../../../src/features/home/model/home-persona-dashboard";
import type { HomeSectionStates } from "../../../../../src/features/home/model/home-persona-types";
import type {
  AppRole,
  ProjectFoldersSnapshot,
  ProvisionedProject,
  RunGroup,
  TeamQaOverview,
} from "../../../../../src/features/home/model/home-types";
import { LOYALTY, PAY, PROVISIONED, RUNS, SHOP, olderOverview, overview, snapshot } from "../home-persona-fixtures";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const READY = { status: "ready" as const, error: null };
const ALL_READY: HomeSectionStates = { projects: READY, runs: READY, folders: READY, qaOverview: READY };

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function render(
  appRole: AppRole,
  options: {
    qa?: boolean;
    overview?: TeamQaOverview | null;
    folders?: ProjectFoldersSnapshot | null;
    runs?: RunGroup[];
    projects?: ProvisionedProject[];
    states?: HomeSectionStates;
  } = {},
): HTMLElement {
  const layout = homeLayoutFor({ appRole, qaChecklistsEnabled: options.qa ?? true });
  const runs = options.runs ?? RUNS;
  const projects = options.projects ?? PROVISIONED;
  const data = buildPersonaDashboard({
    layout,
    groupId: "ws-1",
    folders: options.folders === undefined ? snapshot() : options.folders,
    overview: options.overview === undefined ? overview() : options.overview,
    teamRuns: runs,
    projects,
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root!.render(
      <PersonaOverview
        layout={layout}
        data={data}
        states={options.states ?? ALL_READY}
        projects={projects}
        runs={runs}
        historyCount={0}
        reduced
      />,
    ),
  );
  return container;
}

function kickers(container: HTMLElement): string[] {
  return [...container.querySelectorAll(".dashboard-section-kicker")].map((node) => node.textContent ?? "");
}

function hrefs(container: HTMLElement): string[] {
  return [...container.querySelectorAll("a")].map((anchor) => anchor.getAttribute("href") ?? "");
}

function shortcutLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll(".dashboard-shortcut")].map((node) => node.textContent ?? "");
}

function expectOnlyAlphaciLinks(container: HTMLElement) {
  for (const href of hrefs(container)) {
    expect(href.startsWith("/")).toBe(true);
    expect(href).not.toMatch(/github/i);
  }
}

describe("Developer Home", () => {
  it("shows returned items, my runs, my work and quality", () => {
    const container = render("member");
    expect(kickers(container)).toEqual(["RETURNED BY QA", "MY PIPELINE RUNS", "MY WORK", "QUALITY"]);
    expect(container.querySelectorAll(".metric-cell")).toHaveLength(5);
    expect(container.textContent).toContain("My Projects");
    expect(hrefs(container)).toContain("/groups/ws-1/delivery-projects/dp-shop#my-qa-items");
    expect(hrefs(container)).toContain("/workflows?tab=setup&group=ws-1&project=dp-shop");
    expect(shortcutLabels(container)).toEqual(["NAdd repository", "WView Projects", "RView Runs"]);
    expectOnlyAlphaciLinks(container);
  });

  it("says when nothing came back from QA", () => {
    const container = render("member", { overview: overview([{ ...SHOP, requirements: [] }, PAY, LOYALTY]) });
    expect(container.textContent).toContain("Nothing returned by QA.");
  });

  it("falls back to the team's Projects, and says why", () => {
    const nobody = overview([SHOP, PAY, LOYALTY].map((project) => ({ ...project, viewerMembership: null })));
    const container = render("member", { overview: nobody });
    expect(kickers(container)).toContain("TEAM PROJECTS");
    expect(kickers(container)).toContain("TEAM PIPELINE RUNS");
    expect(container.textContent).toContain("Your Product owner hasn't added you to a Project yet.");
    expect(container.textContent).toContain("Team Projects");
  });

  it("shows the QA block's own error, and keeps the rest", () => {
    const states = { ...ALL_READY, qaOverview: { status: "error" as const, error: "Could not load QA progress for this team." } };
    const container = render("member", { overview: null, states });
    expect(container.querySelector(".home-block-error")?.textContent).toBe("Could not load QA progress for this team.");
    expect(container.querySelectorAll(".run-card").length).toBeGreaterThan(0);
  });

  it("waits in skeletons while its reads are in flight", () => {
    const loading = { status: "loading" as const, error: null };
    const container = render("member", { states: { ...ALL_READY, folders: { ...READY }, qaOverview: loading } });
    expect(container.querySelectorAll(".home-skeleton").length).toBeGreaterThan(0);
    expect(container.querySelector(".metric-cell-num")?.textContent).toBe("—");
  });

  it("waits calmly in an empty team", () => {
    const container = render("member", { folders: snapshot([]), overview: overview([]), projects: [], runs: [] });
    expect(container.textContent).toContain("Waiting for your Product owner to create the first Project.");
    expect(container.querySelector(".getstarted")).toBeNull();
  });
});

describe("QA Team Home", () => {
  it("shows Projects in verification, uat automation, re-tests and defects, with no N", () => {
    const container = render("qa");
    expect(kickers(container)).toEqual([
      "PROJECTS IN VERIFICATION",
      "UAT AUTOMATION",
      "READY FOR RE-TEST",
      "DEFECTS BY SEVERITY",
    ]);
    expect(hrefs(container)).toContain("/projects/p-pay-be#qa");
    expect(container.textContent).toContain("Nothing is waiting for a re-test.");
    expect(shortcutLabels(container)).toEqual(["WView Projects", "RView Runs"]);
    expectOnlyAlphaciLinks(container);
  });

  it("says a newer backend is needed for counts it did not send", () => {
    const container = render("qa", { overview: olderOverview() });
    expect(container.textContent).toContain("Needs a newer backend.");
    expect(container.textContent).toContain("You haven't been added to a Project as QA yet.");
  });

  it("waits calmly in an empty team", () => {
    const container = render("qa", { folders: snapshot([]), overview: overview([]), projects: [], runs: [] });
    expect(container.querySelector(".home-waiting")).not.toBeNull();
  });
});

describe("Product owner Home", () => {
  it("shows what can ship, branch health, what needs attention and quality", () => {
    const container = render("lead");
    expect(kickers(container)).toEqual(["READY FOR PRODUCTION", "BRANCH HEALTH", "PROJECTS NEEDING ATTENTION", "QUALITY"]);
    expect(hrefs(container)).toContain("/projects/p-pay-be#po");
    expect(hrefs(container)).toContain("/workflows?group=ws-1&new=project");
    expect(hrefs(container)).toContain("/groups/ws-1/delivery-projects/dp-pay");
    expect(container.textContent).toContain("Still in verification");
    expect(container.textContent).toContain("Final checks and the merge to main run in PO Studio.");
    expect(container.querySelectorAll(".home-branch-table tbody tr")).toHaveLength(4);
    expect(shortcutLabels(container)[0]).toBe("NCreate Project");
    expectOnlyAlphaciLinks(container);
  });

  it("says when nothing is waiting to ship", () => {
    const container = render("admin", { overview: overview([SHOP, LOYALTY]) });
    expect(container.textContent).toContain("Nothing is signed off and waiting to ship.");
  });

  it("shows only each run's state from an older backend", () => {
    const container = render("lead", { overview: olderOverview() });
    expect(container.textContent).toContain("QA testing signed off");
    expect(container.textContent).not.toContain("Still in verification");
  });

  it("swaps the QA blocks for run-based ones with the capability off", () => {
    const container = render("lead", { qa: false, overview: null });
    expect(kickers(container)).toEqual(["PIPELINE ACTIVITY", "BRANCH HEALTH", "TEAM PROJECTS", "QUALITY"]);
  });

  it("keeps the get-started journey for an empty team", () => {
    const container = render("lead", { folders: snapshot([]), overview: overview([]), projects: [], runs: [] });
    expect(container.querySelector(".getstarted")).not.toBeNull();
    expect(container.textContent).toContain("Developers add repositories");
  });
});
