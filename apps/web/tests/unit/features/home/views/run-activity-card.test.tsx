import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { DashboardWorkspaceOverview } from "../../../../../src/features/home/dashboard/views/workspace-overview";
import { RunActivityCard } from "../../../../../src/features/home/dashboard/views/pipeline-activity";
import type {
  GroupSummary,
  ProvisionedProject,
  RunGroup,
} from "../../../../../src/features/home/model/home-types";
import type { StageReport } from "../../../../../src/shared/api/contracts";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const ESC = String.fromCharCode(27);

function stage(id: StageReport["stage"], status: StageReport["status"], title = ""): StageReport {
  return {
    stage: id,
    status,
    runId: 7,
    friendlyMessages: title ? [{ severity: "error", title, detail: "", hint: "" }] : [],
    githubRunUrl: "https://github.com/acme/api/actions/runs/7",
    updatedAt: "2026-10-13T10:00:00Z",
  };
}

const FAILED: RunGroup = {
  runId: 7,
  repoFullName: "acme/api",
  branch: "uat",
  commitSha: "abcdef1234567",
  startedAt: "2026-10-13T10:00:00Z",
  overallStatus: "failure",
  stages: [
    stage("access", "success"),
    stage("quality", "success"),
    stage("package", "stalled"),
    stage("verify", "failure", `${ESC}[31m2 browser tests failed${ESC}[39m`),
  ],
} as RunGroup;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function mount(node: React.ReactNode): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(node));
  return container;
}

describe("Home run card", () => {
  /* Package stalled without a message, so the line comes from Verify. */
  it("shows why a failed run failed, without terminal colour codes", () => {
    const container = mount(<RunActivityCard run={FAILED} reduced />);
    const reason = container.querySelector(".run-card-reason");
    expect(reason?.textContent).toBe("Verify: 2 browser tests failed");
    expect(container.textContent).not.toContain(ESC);
    expect(container.querySelector("a")?.getAttribute("aria-label")).toContain("Verify: 2 browser tests failed.");
  });

  it("draws stalled and blocked stages with their own dot classes", () => {
    const blocked = { ...FAILED, stages: [stage("access", "failure", "Token rejected"), stage("quality", "blocked")] };
    const container = mount(<RunActivityCard run={blocked} reduced />);
    const dots = [...container.querySelectorAll(".run-track-dot")].map((dot) => dot.className);
    expect(dots[0]).toContain("pipeline-dot--failure");
    expect(dots[1]).toContain("pipeline-dot--blocked");
    const stalled = mount(<RunActivityCard run={FAILED} reduced />);
    expect(stalled.querySelector(".pipeline-dot--stalled")).not.toBeNull();
  });

  it("shows no reason line on a run that passed", () => {
    const passed = { ...FAILED, overallStatus: "success" as const, stages: [stage("access", "success")] };
    const container = mount(<RunActivityCard run={passed} reduced />);
    expect(container.querySelector(".run-card-reason")).toBeNull();
  });

  it("opens the run's Project on its Pipeline tab, or the runs page when the repository is unknown", () => {
    const linked = mount(<RunActivityCard run={FAILED} reduced projectIds={new Map([["acme/api", "p1"]])} />);
    expect(linked.querySelector("a")?.getAttribute("href")).toBe("/projects/p1#pipeline");
    const unknown = mount(<RunActivityCard run={FAILED} reduced />);
    expect(unknown.querySelector("a")?.getAttribute("href")).toBe("/runs");
  });

  it("links the team dashboard's run cards to the Project from the projects list, never to GitHub", () => {
    const project = { id: "p1", repoFullName: "acme/API", serviceName: "api", status: "provisioned" } as unknown as ProvisionedProject;
    const container = mount(
      <DashboardWorkspaceOverview
        group={{ id: "g1", name: "Kitchen", role: "member" } as unknown as GroupSummary}
        portfolio={[]}
        assignments={[]}
        activity={[]}
        projects={[project]}
        runs={[FAILED]}
        workflowHistoryCount={0}
        loading={false}
        reduced
        canOpenActivity={false}
        shortcuts={["runs"]}
      />,
    );
    const card = container.querySelector(".run-card a");
    expect(card?.getAttribute("href")).toBe("/projects/p1#pipeline");
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.some((href) => href.includes("github.com"))).toBe(false);
  });
});
