import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { DashboardWorkspaceOverview } from "../../../../../src/features/home/dashboard/views/workspace-overview";
import type {
  GroupActivityItem,
  GroupSummary,
  ProvisionedProject,
} from "../../../../../src/features/home/model/home-types";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const GROUP = { id: "g1", name: "Kitchen", role: "member" } as unknown as GroupSummary;
const PROJECT = {
  id: "p1",
  repoFullName: "acme/api",
  serviceName: "api",
  status: "provisioned",
} as unknown as ProvisionedProject;
const ACTIVITY = [
  { id: "a1", message: "Added a member", actorLabel: "ana", createdAt: "2026-09-30T10:00:00Z" },
] as unknown as GroupActivityItem[];

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function render(
  canOpenActivity: boolean,
  activity: GroupActivityItem[] = ACTIVITY,
  projects: ProvisionedProject[] = [PROJECT],
): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root!.render(
      <DashboardWorkspaceOverview
        group={GROUP}
        portfolio={[]}
        assignments={[]}
        activity={activity}
        projects={projects}
        runs={[]}
        workflowHistoryCount={0}
        loading={false}
        reduced
        canOpenActivity={canOpenActivity}
      />,
    ),
  );
  return container;
}

function activityLink(container: HTMLElement): Element | undefined {
  return [...container.querySelectorAll("a")].find((a) => a.getAttribute("href") === "/groups/g1/activity");
}

describe("Home activity rail", () => {
  it("links to the activity page when the viewer may open it", () => {
    expect(activityLink(render(true))).toBeDefined();
  });

  it("shows no link when the viewer may not open it", () => {
    expect(activityLink(render(false))).toBeUndefined();
  });

  it("shows no group-lead teaser to a viewer who cannot open activity", () => {
    const container = render(false, []);
    expect(container.textContent).not.toContain("available to group leads");
    expect(container.textContent).toContain("No recent activity in this workspace.");
  });
});

describe("Home empty team", () => {
  it("shows the get-started journey for a team with no projects", () => {
    const container = render(false, [], []);
    expect(container.querySelector(".dashboard-flow--empty")).not.toBeNull();
  });
});
