import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  useProjectMembersViewModel,
  type ProjectMembersViewModel,
} from "../../../../../../src/features/groups/delivery-project/view-models/use-project-members-view-model";
import {
  addProjectMember,
  getProjectMembers,
  removeProjectMember,
  syncProjectMembers,
} from "../../../../../../src/features/groups/data/project-members-api";
import { groupsRepository } from "../../../../../../src/features/groups/data/groups-repository";
import { ApiError } from "../../../../../../src/shared/api/request";
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

const developer = {
  id: "m1",
  deliveryProjectId: "dp1",
  userId: "u-dev",
  memberKind: "developer" as const,
  status: "active" as const,
  addedBy: "u-lead",
  createdAt: "2026-10-08T00:00:00Z",
  updatedAt: "2026-10-08T00:00:00Z",
  login: "dana",
  name: "Dana Dev",
  avatarUrl: null,
};
const qa = { ...developer, id: "m2", userId: "u-qa", memberKind: "qa" as const, login: "quinn", name: "Quinn QA" };

describe("useProjectMembersViewModel", () => {
  let container: HTMLDivElement;
  let root: Root;
  const latest: { vm: ProjectMembersViewModel | null } = { vm: null };
  const cur = () => latest.vm!;

  function Harness({ appRole }: Readonly<{ appRole: AppRole | null }>) {
    const vm = useProjectMembersViewModel({ groupId: "g1", deliveryProjectId: "dp1", appRole });
    useEffect(() => {
      latest.vm = vm;
    });
    return null;
  }

  function render(appRole: AppRole | null) {
    act(() => root.render(<Harness appRole={appRole} />));
  }

  beforeEach(() => {
    jest.clearAllMocks();
    capabilities.hierarchyGithubSyncMode = "stub";
    (getProjectMembers as jest.Mock).mockResolvedValue({ items: [developer] });
    (groupsRepository.members as jest.Mock).mockResolvedValue([
      { userId: "u-dev", role: "member", memberStatus: "active", login: "dana", name: "Dana Dev", appRole: "member" },
      { userId: "u-qa", role: "member", memberStatus: "active", login: "quinn", name: "Quinn QA", appRole: "qa" },
      { userId: "u-lead", role: "admin", memberStatus: "active", login: "lee", name: "Lee Lead", appRole: "lead" },
    ]);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("loads the members for a lead", async () => {
    render("lead");
    await poll(() => cur().status === "ready");
    expect(getProjectMembers).toHaveBeenCalledWith("dp1");
    expect(cur().visible).toBe(true);
    expect(cur().members.map((m) => m.userId)).toEqual(["u-dev"]);
  });

  it("never loads for a Developer or QA, and stays hidden", () => {
    render("member");
    expect(cur().visible).toBe(false);
    render("qa");
    expect(cur().visible).toBe(false);
    expect(getProjectMembers).not.toHaveBeenCalled();
  });

  it("hides the panel when the server refuses the caller", async () => {
    (getProjectMembers as jest.Mock).mockRejectedValue(new ApiError("Forbidden", 403, {}));
    render("lead");
    await poll(() => cur().status === "forbidden");
    expect(cur().visible).toBe(false);
  });

  it("offers only eligible team members and adds one, reporting the GitHub grant", async () => {
    capabilities.hierarchyGithubSyncMode = "live";
    render("admin");
    await poll(() => cur().status === "ready");
    act(() => cur().openAdd());
    await poll(() => cur().candidatesStatus === "ready");
    expect(cur().candidates.map((m) => m.userId)).toEqual(["u-qa"]);

    (addProjectMember as jest.Mock).mockResolvedValue({
      member: qa,
      githubAccess: { syncMode: "live", repositoriesQueued: 0 },
    });
    act(() => cur().setSelectedUserId("u-qa"));
    await act(async () => {
      await cur().add();
    });
    expect(addProjectMember).toHaveBeenCalledWith("dp1", "u-qa");
    expect(cur().addOpen).toBe(false);
    expect(cur().members.map((m) => m.userId)).toEqual(["u-dev", "u-qa"]);
    expect(cur().notice).toContain("QA Team get no GitHub write access");
  });

  it("shows Granting Write on N repositories after adding a Developer in live mode", async () => {
    capabilities.hierarchyGithubSyncMode = "live";
    (getProjectMembers as jest.Mock).mockResolvedValue({ items: [] });
    (addProjectMember as jest.Mock).mockResolvedValue({
      member: developer,
      githubAccess: { syncMode: "live", repositoriesQueued: 3 },
    });
    render("lead");
    await poll(() => cur().status === "empty");
    act(() => cur().openAdd());
    act(() => cur().setSelectedUserId("u-dev"));
    await act(async () => {
      await cur().add();
    });
    expect(cur().notice).toBe("Dana Dev joined as a Developer. Granting Write on 3 repositories…");
  });

  it("maps an add refusal into the dialog and keeps it open", async () => {
    (addProjectMember as jest.Mock).mockRejectedValue(
      new ApiError("Bad Request", 400, { code: "PROJECT_MEMBER_NOT_IN_TEAM" }),
    );
    render("lead");
    await poll(() => cur().status === "ready");
    act(() => cur().openAdd());
    act(() => cur().setSelectedUserId("u-qa"));
    await act(async () => {
      await cur().add();
    });
    expect(cur().addOpen).toBe(true);
    expect(cur().addError).toContain("isn't an active member of this Project's team");
  });

  it("asks before removing, then drops the member", async () => {
    capabilities.hierarchyGithubSyncMode = "live";
    (removeProjectMember as jest.Mock).mockResolvedValue({
      member: { ...developer, status: "removed" },
      githubAccess: { syncMode: "live", repositoriesQueued: 2 },
    });
    render("lead");
    await poll(() => cur().status === "ready");
    act(() => cur().askRemove(developer));
    expect(cur().removeTarget?.userId).toBe("u-dev");
    expect(removeProjectMember).not.toHaveBeenCalled();
    await act(async () => {
      await cur().confirmRemove();
    });
    expect(removeProjectMember).toHaveBeenCalledWith("dp1", "u-dev");
    expect(cur().members).toEqual([]);
    expect(cur().removeTarget).toBeNull();
    expect(cur().notice).toContain("Removing Write from 2 repositories…");
  });

  it("maps a remove refusal to a panel error", async () => {
    (removeProjectMember as jest.Mock).mockRejectedValue(
      new ApiError("Not Found", 404, { code: "PROJECT_MEMBER_NOT_FOUND" }),
    );
    render("lead");
    await poll(() => cur().status === "ready");
    act(() => cur().askRemove(developer));
    await act(async () => {
      await cur().confirmRemove();
    });
    expect(cur().error).toBe("That person is no longer a member of this Project.");
    expect(cur().members).toHaveLength(1);
  });

  it("re-syncs only in live mode and reports the queued grants", async () => {
    render("lead");
    await poll(() => cur().status === "ready");
    expect(cur().syncLive).toBe(false);

    capabilities.hierarchyGithubSyncMode = "live";
    render("lead");
    expect(cur().syncLive).toBe(true);
    (syncProjectMembers as jest.Mock).mockResolvedValue({ items: [developer, qa], syncMode: "live", repositoriesQueued: 5 });
    await act(async () => {
      await cur().resync();
    });
    expect(cur().notice).toBe("Granting Write on 5 repositories…");
    expect(cur().members).toHaveLength(2);
  });

  it("maps the 503 a stub backend answers to re-sync", async () => {
    capabilities.hierarchyGithubSyncMode = "live";
    (syncProjectMembers as jest.Mock).mockRejectedValue(new ApiError("Unavailable", 503, {}));
    render("lead");
    await poll(() => cur().status === "ready");
    await act(async () => {
      await cur().resync();
    });
    expect(cur().error).toContain("live GitHub sync is switched on");
  });
});
