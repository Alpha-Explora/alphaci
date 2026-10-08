import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ProjectMembersPanel } from "../../../../../../src/features/groups/delivery-project/views/project-members-panel";
import { useProjectMembersViewModel } from "../../../../../../src/features/groups/delivery-project/view-models/use-project-members-view-model";
import { getProjectMembers } from "../../../../../../src/features/groups/data/project-members-api";
import { groupsRepository } from "../../../../../../src/features/groups/data/groups-repository";
import type { AppRole } from "../../../../../../src/shared/api/contracts";

jest.mock("../../../../../../src/features/groups/data/project-members-api", () => ({
  addProjectMember: jest.fn(),
  getProjectMembers: jest.fn(),
  removeProjectMember: jest.fn(),
  syncProjectMembers: jest.fn(),
}));
jest.mock("../../../../../../src/features/groups/data/groups-repository", () => ({
  groupsRepository: { members: jest.fn() },
}));
const capabilities = { hierarchyGithubSyncMode: "stub" as "stub" | "live" };
jest.mock("../../../../../../src/features/capabilities/current", () => ({
  useCapabilities: () => capabilities,
}));

async function poll(check: () => boolean, attempts = 60): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error("condition not met");
}

function Section({ appRole }: Readonly<{ appRole: AppRole | null }>) {
  const vm = useProjectMembersViewModel({ groupId: "g1", deliveryProjectId: "dp1", appRole });
  return <ProjectMembersPanel vm={vm} />;
}

const base = {
  deliveryProjectId: "dp1",
  status: "active" as const,
  addedBy: "u-lead",
  createdAt: "2026-10-08T00:00:00Z",
  updatedAt: "2026-10-08T00:00:00Z",
  avatarUrl: null,
};

describe("ProjectMembersPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  const text = () => container.textContent ?? "";
  const button = (label: string) =>
    Array.from(container.querySelectorAll("button")).find((b) => b.textContent === label);

  beforeEach(() => {
    jest.clearAllMocks();
    capabilities.hierarchyGithubSyncMode = "stub";
    (getProjectMembers as jest.Mock).mockResolvedValue({
      items: [
        { ...base, id: "m1", userId: "u-dev", memberKind: "developer", login: "dana", name: "Dana Dev" },
        { ...base, id: "m2", userId: "u-qa", memberKind: "qa", login: "quinn", name: "Quinn QA" },
      ],
    });
    (groupsRepository.members as jest.Mock).mockResolvedValue([
      { userId: "u-new", role: "member", memberStatus: "active", login: "nia", name: "Nia New", appRole: "member" },
    ]);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders nothing for a Developer or QA", () => {
    act(() => root.render(<Section appRole="member" />));
    expect(container.innerHTML).toBe("");
    act(() => root.render(<Section appRole="qa" />));
    expect(container.innerHTML).toBe("");
  });

  it("lists members with kind badges for a lead, and explains the GitHub effect", async () => {
    act(() => root.render(<Section appRole="lead" />));
    await poll(() => text().includes("Dana Dev"));
    const rows = Array.from(container.querySelectorAll(".hier-row"));
    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelector(".project-members__kind--developer")?.textContent).toBe("Developer");
    expect(rows[1]?.querySelector(".project-members__kind--qa")?.textContent).toBe("QA Team");
    expect(text()).toContain("Developers get Write on every repository created in this Project");
    expect(text()).toContain("a lead grants access per repository");
    expect(text()).toContain("QA Team get no GitHub write access. They run Playwright in QA Studio through ALPHACI.");
    expect(container.querySelector('[aria-label="Remove Dana Dev from this Project"]')).not.toBeNull();
  });

  it("shows the stub note and no re-sync button while sync is stub", async () => {
    act(() => root.render(<Section appRole="lead" />));
    await poll(() => text().includes("Dana Dev"));
    expect(text()).toContain("GitHub access is granted once live GitHub sync is switched on.");
    expect(button("Re-sync GitHub access")).toBeUndefined();
  });

  it("drops the stub note and offers re-sync in live mode", async () => {
    capabilities.hierarchyGithubSyncMode = "live";
    act(() => root.render(<Section appRole="admin" />));
    await poll(() => text().includes("Dana Dev"));
    expect(text()).not.toContain("GitHub access is granted once live GitHub sync is switched on.");
    expect(button("Re-sync GitHub access")).toBeDefined();
  });

  it("opens the add picker with eligible team members and their kind", async () => {
    act(() => root.render(<Section appRole="lead" />));
    await poll(() => text().includes("Dana Dev"));
    act(() => button("Add member")!.click());
    await poll(() => document.querySelector("#project-member-user option[value='u-new']") !== null);
    expect(document.querySelector("#project-member-user option[value='u-new']")?.textContent).toBe(
      "Nia New (@nia) · Developer",
    );
  });

  it("asks for confirmation before removing", async () => {
    act(() => root.render(<Section appRole="lead" />));
    await poll(() => text().includes("Quinn QA"));
    act(() => (container.querySelector('[aria-label="Remove Quinn QA from this Project"]') as HTMLButtonElement).click());
    await poll(() => document.body.textContent?.includes("Remove Quinn QA?") ?? false);
    expect(document.body.textContent).toContain("They leave this Project's QA. Nothing changes on GitHub.");
  });

  it("does not link to GitHub", async () => {
    act(() => root.render(<Section appRole="lead" />));
    await poll(() => text().includes("Dana Dev"));
    expect(container.querySelector('a[href*="github.com"]')).toBeNull();
  });
});
