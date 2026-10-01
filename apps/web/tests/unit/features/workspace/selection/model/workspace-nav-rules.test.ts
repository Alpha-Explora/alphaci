import {
  canOpenTeamActivity,
  adminOtherTeams,
  selectableWorkspaces,
  SIDEBAR_SHOWS_CHECKLISTS,
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
});

describe("sidebarMainItems", () => {
  /* Requirements live on each Project now; the team Checklists page left the sidebar. */
  it("leaves Checklists out of the sidebar by default, even with the capability on", () => {
    expect(SIDEBAR_SHOWS_CHECKLISTS).toBe(false);
    expect(
      sidebarMainItems({ guest: false, qaChecklistsEnabled: true, canOpenActivity: true }),
    ).toEqual(["home", "projects", "teams", "activity", "inbox"]);
  });

  it("adds Checklists (when shown and the capability is on) and Activity after Teams", () => {
    expect(
      sidebarMainItems({ guest: false, qaChecklistsEnabled: true, canOpenActivity: true, showChecklists: true }),
    ).toEqual(["home", "projects", "teams", "checklists", "activity", "inbox"]);
  });

  it("keeps Checklists hidden while the QA checklists capability is off", () => {
    expect(
      sidebarMainItems({ guest: false, qaChecklistsEnabled: false, canOpenActivity: true, showChecklists: true }),
    ).toEqual(["home", "projects", "teams", "activity", "inbox"]);
  });

  /* A QA Team member used to get the link, then "You don't have access". */
  it("hides Activity from someone who cannot open it", () => {
    expect(
      sidebarMainItems({ guest: false, qaChecklistsEnabled: true, canOpenActivity: false }),
    ).toEqual(["home", "projects", "teams", "inbox"]);
  });

  it("shows a guest only Home and Projects", () => {
    expect(
      sidebarMainItems({ guest: true, qaChecklistsEnabled: true, canOpenActivity: true }),
    ).toEqual(["home", "projects"]);
  });
});

/* Mirrors GET /groups/:id/activity: assertGroupManagerOrPlatformAdmin with
 * ['admin', 'delegated_lead'] — a platform admin, or the team's Lead or
 * Delegated lead. */
describe("canOpenTeamActivity", () => {
  /* The backend derives the team role from the global app role, so a Team lead
   * on any team they belong to gets in, whatever their stored team role. */
  it("opens it to a Team lead on a team they belong to, whatever the stored team role", () => {
    for (const teamRole of ["admin", "delegated_lead", "member", "viewer"] as const) {
      expect(canOpenTeamActivity({ guest: false, appRole: "lead", teamRole })).toBe(true);
    }
  });

  it("shuts it to QA and Developers, even with a stored lead-tier team role", () => {
    for (const appRole of ["qa", "member"] as const) {
      for (const teamRole of ["admin", "delegated_lead", "member", "viewer"] as const) {
        expect(canOpenTeamActivity({ guest: false, appRole, teamRole })).toBe(false);
      }
    }
  });

  it("opens it to a platform admin on any team, even before the team list loads", () => {
    expect(canOpenTeamActivity({ guest: false, appRole: "admin", teamRole: null })).toBe(true);
    expect(
      canOpenTeamActivity({ guest: false, appRole: "member", platformRole: "super_admin", teamRole: "member" }),
    ).toBe(true);
    expect(canOpenTeamActivity({ guest: false, appRole: "qa", platformRole: "admin" })).toBe(true);
  });

  it("says no until the team resolves, to anyone else", () => {
    expect(canOpenTeamActivity({ guest: false, appRole: "lead", teamRole: null })).toBe(false);
    expect(canOpenTeamActivity({ guest: false, appRole: "qa" })).toBe(false);
  });

  /* An allow-list: an unknown platform role or team role opens nothing. */
  it("ignores roles it does not know", () => {
    expect(canOpenTeamActivity({ guest: false, appRole: "qa", platformRole: "auditor" })).toBe(false);
    expect(
      canOpenTeamActivity({
        guest: false,
        appRole: "qa",
        teamRole: "owner" as unknown as "member",
      }),
    ).toBe(false);
  });

  it("never opens it to a guest", () => {
    expect(canOpenTeamActivity({ guest: true, appRole: "admin", teamRole: "admin" })).toBe(false);
  });
});
