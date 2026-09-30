import {
  OTHER_TEAMS_HEADING,
  adminOtherTeams,
  selectableWorkspaces,
  sidebarMainItems,
  workspaceSwitcherKind,
} from "../../../../../../src/features/workspace/selection/model/workspace-types";

const MINE = [
  { id: "t-1", name: "Team Blaine", kind: "team" as const, role: "admin" as const },
  { id: "t-2", name: "Platform", kind: "team" as const, role: "member" as const },
];

describe("adminOtherTeams", () => {
  it("is every visible team the admin is not a member of, by name", () => {
    const all = [
      { id: "t-9", name: "Zeta" },
      { id: "t-1", name: "Team Blaine" },
      { id: "t-5", name: "Johns Kitchen" },
      { id: "t-2", name: "Platform" },
    ];
    expect(adminOtherTeams(MINE, all)).toEqual([
      { id: "t-5", name: "Johns Kitchen", kind: "team", role: "admin" },
      { id: "t-9", name: "Zeta", kind: "team", role: "admin" },
    ]);
  });

  it("is empty when the admin is in every team, or there are none", () => {
    expect(adminOtherTeams(MINE, MINE)).toEqual([]);
    expect(adminOtherTeams(MINE, [])).toEqual([]);
  });

  it("lists everything for an admin in no team", () => {
    expect(adminOtherTeams([], [{ id: "t-5", name: "Johns Kitchen" }]).map((t) => t.id)).toEqual([
      "t-5",
    ]);
  });
});

describe("selectableWorkspaces", () => {
  it("is the caller's own teams, then an admin's others", () => {
    const others = adminOtherTeams(MINE, [{ id: "t-5", name: "Johns Kitchen" }]);
    expect(selectableWorkspaces({ enabled: true, items: MINE }, others).map((t) => t.id)).toEqual([
      "t-1",
      "t-2",
      "t-5",
    ]);
    expect(selectableWorkspaces(null, [])).toEqual([]);
  });

  /* An admin who belongs to no team still gets a picker, not "No team yet". */
  it("counts the other teams when choosing the header slot", () => {
    const others = adminOtherTeams([], [{ id: "t-5", name: "Johns Kitchen" }]);
    const workspaces = { enabled: true, items: [] };
    const count = selectableWorkspaces(workspaces, others).length;
    expect(workspaceSwitcherKind("ready", workspaces, count, true)).toBe("picker");
    expect(workspaceSwitcherKind("ready", workspaces, 0, false)).toBe("no-team");
  });

  it("files them under the admin heading", () => {
    expect(OTHER_TEAMS_HEADING).toBe("Other teams (admin)");
  });
});

describe("sidebarMainItems", () => {
  it("adds Checklists (capability on) and Activity after Teams", () => {
    expect(sidebarMainItems({ guest: false, qaChecklistsEnabled: true })).toEqual([
      "home",
      "projects",
      "teams",
      "checklists",
      "activity",
      "inbox",
    ]);
  });

  it("hides Checklists while the QA checklists capability is off", () => {
    expect(sidebarMainItems({ guest: false, qaChecklistsEnabled: false })).toEqual([
      "home",
      "projects",
      "teams",
      "activity",
      "inbox",
    ]);
  });

  it("shows a guest only Home and Projects", () => {
    expect(sidebarMainItems({ guest: true, qaChecklistsEnabled: true })).toEqual([
      "home",
      "projects",
    ]);
  });
});
