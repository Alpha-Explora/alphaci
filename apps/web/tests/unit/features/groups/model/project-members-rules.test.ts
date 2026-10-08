import {
  addedMessage,
  canManageProjectMembers,
  candidateKind,
  eligibleProjectMemberCandidates,
  projectMemberErrorMessage,
  removedMessage,
  resyncedMessage,
  DEVELOPER_ACCESS_NOTE,
} from "../../../../../src/features/groups/model/project-members-rules";
import type {
  DeliveryProjectMember,
  GroupMember,
} from "../../../../../src/features/groups/data/hierarchy-contracts";
import { ApiError } from "../../../../../src/shared/api/request";

function teamMember(overrides: Partial<GroupMember>): GroupMember {
  return {
    id: `gm-${overrides.userId}`,
    groupId: "g1",
    userId: "u",
    role: "member",
    memberStatus: "active",
    login: "login",
    name: "Name",
    email: null,
    avatarUrl: null,
    invitedBy: null,
    invitedAt: null,
    removedAt: null,
    removedBy: null,
    removalReason: null,
    createdAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

function projectMember(overrides: Partial<DeliveryProjectMember>): DeliveryProjectMember {
  return {
    id: "m1",
    deliveryProjectId: "dp1",
    userId: "u1",
    memberKind: "developer",
    status: "active",
    addedBy: "lead",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    login: "dev",
    name: "Dana Dev",
    avatarUrl: null,
    ...overrides,
  };
}

function refusal(status: number, code?: string) {
  return new ApiError(`Request failed with status ${status}`, status, code ? { code, message: "x" } : { message: "x" });
}

describe("canManageProjectMembers", () => {
  it("is leads and admins only, by allow-list", () => {
    expect(canManageProjectMembers("lead")).toBe(true);
    expect(canManageProjectMembers("admin")).toBe(true);
    expect(canManageProjectMembers("member")).toBe(false);
    expect(canManageProjectMembers("qa")).toBe(false);
    expect(canManageProjectMembers(null)).toBe(false);
    expect(canManageProjectMembers(undefined)).toBe(false);
  });
});

describe("eligibleProjectMemberCandidates", () => {
  const team = [
    teamMember({ userId: "dev", appRole: "member" }),
    teamMember({ userId: "qa", appRole: "qa" }),
    teamMember({ userId: "lead", appRole: "lead", role: "admin" }),
    teamMember({ userId: "admin", appRole: "admin" }),
    teamMember({ userId: "gone", appRole: "member", memberStatus: "removed" }),
    teamMember({ userId: "already", appRole: "member" }),
    teamMember({ userId: "unknown-member", appRole: undefined, role: "member" }),
    teamMember({ userId: "unknown-manager", appRole: undefined, role: "delegated_lead" }),
  ];

  it("keeps active Developers and QA Team not yet in the Project", () => {
    const ids = eligibleProjectMemberCandidates(team, [projectMember({ userId: "already" })]).map((m) => m.userId);
    expect(ids).toEqual(["dev", "qa", "unknown-member"]);
  });

  it("offers a removed Project member again", () => {
    const ids = eligibleProjectMemberCandidates(team, [projectMember({ userId: "already", status: "removed" })]).map(
      (m) => m.userId,
    );
    expect(ids).toContain("already");
  });

  it("previews the kind from the app role", () => {
    expect(candidateKind({ appRole: "member" })).toBe("developer");
    expect(candidateKind({ appRole: "qa" })).toBe("qa");
    expect(candidateKind({ appRole: undefined })).toBeNull();
  });
});

describe("GitHub effect messages", () => {
  it("reports queued Write grants for a Developer in live mode", () => {
    expect(addedMessage(projectMember({}), { syncMode: "live", repositoriesQueued: 3 })).toBe(
      "Dana Dev joined as a Developer. Granting Write on 3 repositories…",
    );
    expect(addedMessage(projectMember({}), { syncMode: "live", repositoriesQueued: 1 })).toContain(
      "Granting Write on 1 repository…",
    );
  });

  it("says nothing is granted until live sync in stub mode", () => {
    expect(addedMessage(projectMember({}), { syncMode: "stub", repositoriesQueued: 0 })).toContain(
      "GitHub access is granted once live GitHub sync is switched on.",
    );
  });

  it("tells QA they get no GitHub write", () => {
    expect(addedMessage(projectMember({ memberKind: "qa" }), { syncMode: "live", repositoriesQueued: 0 })).toContain(
      "QA Team get no GitHub write access",
    );
  });

  it("reports revokes on removal and the re-sync count", () => {
    expect(removedMessage(projectMember({}), { syncMode: "live", repositoriesQueued: 2 })).toContain(
      "Removing Write from 2 repositories…",
    );
    expect(removedMessage(projectMember({ memberKind: "qa" }), { syncMode: "live", repositoriesQueued: 0 })).toBe(
      "Dana Dev was removed from this Project.",
    );
    expect(resyncedMessage(4)).toBe("Granting Write on 4 repositories…");
    expect(resyncedMessage(0)).toContain("already has Write");
  });

  it("explains that attached repositories need a per-repository grant", () => {
    expect(DEVELOPER_ACCESS_NOTE).toContain("repository created in this Project");
    expect(DEVELOPER_ACCESS_NOTE).toContain("a lead grants access per repository");
  });
});

describe("projectMemberErrorMessage", () => {
  it.each([
    ["PROJECT_MEMBER_ROLE_NOT_ALLOWED", 400, "Leads and admins already manage every repository"],
    ["PROJECT_MEMBER_NOT_IN_TEAM", 400, "isn't an active member of this Project's team"],
    ["PROJECT_ARCHIVED", 400, "This Project is archived"],
    ["project_member_not_found", 404, "no longer a member of this Project"],
  ])("maps %s to a sentence", (code, status, sentence) => {
    expect(projectMemberErrorMessage(refusal(status, code), "add")).toContain(sentence);
  });

  it("maps the manager check and the stub sync refusal", () => {
    expect(projectMemberErrorMessage(refusal(403), "add")).toBe(
      "Only the team's leads and admins can change Project members.",
    );
    expect(projectMemberErrorMessage(refusal(404), "remove")).toContain("no longer exists");
    expect(projectMemberErrorMessage(refusal(503), "sync")).toContain("live GitHub sync is switched on");
  });

  it("falls back per action", () => {
    expect(projectMemberErrorMessage(new Error("boom"), "add")).toBe("The member could not be added. Please try again.");
    expect(projectMemberErrorMessage(refusal(500), "sync")).toBe("GitHub access could not be re-synced. Please try again.");
  });
});
