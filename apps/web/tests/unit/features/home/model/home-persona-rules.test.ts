import {
  deliveryProjectHref,
  foldersInScope,
  homeEmptyStateFor,
  homeLinkContext,
  homePersonaFor,
  homeRoleBadge,
  homeScopeFor,
  isPersonaHomeEmpty,
  projectStudioHref,
  qaProjectsInScope,
  scopeFallbackLine,
  teamProjectIds,
} from "../../../../../src/features/home/model/home-persona-rules";
import type { HomeSectionStates } from "../../../../../src/features/home/model/home-persona-types";
import type { AppRole } from "../../../../../src/features/home/model/home-types";
import { FOLDERS, LOYALTY, PAY, SHOP, folder, overview, qaProject, repository } from "../home-persona-fixtures";

describe("homePersonaFor (allow-list per role)", () => {
  it.each([
    ["member", true, "developer"],
    ["member", false, "developer"],
    ["qa", true, "qa"],
    ["qa", false, "team"],
    ["lead", true, "product-owner"],
    ["lead", false, "product-owner"],
    ["admin", true, "product-owner"],
    ["admin", false, "product-owner"],
    [undefined, true, "team"],
    [null, true, "team"],
  ] as const)("%s with QA %s sees the %s Home", (appRole, qaChecklistsEnabled, persona) => {
    expect(homePersonaFor({ appRole, qaChecklistsEnabled })).toBe(persona);
  });

  it("gives a role it does not know the team dashboard, never another role's Home", () => {
    for (const appRole of ["owner", "viewer", "", "__proto__", "constructor"]) {
      expect(homePersonaFor({ appRole: appRole as AppRole, qaChecklistsEnabled: true })).toBe("team");
    }
  });
});

describe("homeRoleBadge", () => {
  it("labels each role with its persona name", () => {
    expect(homeRoleBadge("lead")).toEqual({ role: "lead", label: "Product owner" });
    expect(homeRoleBadge("member")).toEqual({ role: "member", label: "Developer" });
    expect(homeRoleBadge("qa")).toEqual({ role: "qa", label: "QA Team" });
    expect(homeRoleBadge("admin")).toEqual({ role: "admin", label: "Admin" });
  });

  it("shows no badge without a known role", () => {
    expect(homeRoleBadge(undefined)).toBeNull();
    expect(homeRoleBadge("owner" as AppRole)).toBeNull();
  });
});

describe("homeScopeFor (my Projects)", () => {
  it("narrows a Developer to the Projects they are a Developer member of", () => {
    expect(homeScopeFor({ persona: "developer", folders: FOLDERS, overview: overview() })).toEqual({
      mode: "mine",
      projectIds: ["dp-shop"],
    });
  });

  it("narrows the QA Team to the Projects they are QA on", () => {
    expect(homeScopeFor({ persona: "qa", folders: FOLDERS, overview: overview() })).toEqual({
      mode: "mine",
      projectIds: ["dp-pay"],
    });
  });

  it("falls back to every team Project when the viewer is a member of none, as everyone is today", () => {
    const nobody = overview([{ ...SHOP, viewerMembership: null }, { ...PAY, viewerMembership: "developer" }]);
    const scope = homeScopeFor({ persona: "qa", folders: FOLDERS, overview: nobody });
    expect(scope).toEqual({ mode: "fallback", projectIds: ["dp-shop", "dp-pay", "dp-new"] });
    expect(scopeFallbackLine("qa", scope)).toBe("You haven't been added to a Project as QA yet.");
    expect(scopeFallbackLine("developer", { ...scope })).toBe("Your Product owner hasn't added you to a Project yet.");
  });

  it("covers the team, without the line, when membership is not known (no overview)", () => {
    const scope = homeScopeFor({ persona: "developer", folders: FOLDERS, overview: null });
    expect(scope.mode).toBe("team");
    expect(scope.projectIds).toEqual(["dp-shop", "dp-pay", "dp-new"]);
    expect(scopeFallbackLine("developer", scope)).toBeNull();
  });

  it("always shows a Product owner the whole team", () => {
    expect(homeScopeFor({ persona: "product-owner", folders: FOLDERS, overview: overview() }).mode).toBe("team");
  });

  it("counts a Project only the overview names as the team's", () => {
    const extra = qaProject("dp-extra", "Extra");
    expect(teamProjectIds([FOLDERS[0]], overview([SHOP, extra]))).toEqual(["dp-shop", "dp-extra"]);
    expect(teamProjectIds([], null)).toEqual([]);
  });

  it("selects the folders and overview Projects in scope", () => {
    const scope = { mode: "mine" as const, projectIds: ["dp-pay"] };
    expect(foldersInScope(FOLDERS, scope).map((entry) => entry.name)).toEqual(["Payments"]);
    expect(qaProjectsInScope(overview([SHOP, PAY, LOYALTY]), scope)).toEqual([PAY]);
    expect(qaProjectsInScope(null, scope)).toEqual([]);
  });
});

describe("Home links", () => {
  const links = homeLinkContext("ws 1", FOLDERS);

  it("opens a Project page on ALPHACI", () => {
    expect(deliveryProjectHref("ws 1", "dp/1")).toBe("/groups/ws%201/delivery-projects/dp%2F1");
  });

  it("opens a studio on the Project's frontend repository, else its first linked one", () => {
    expect(projectStudioHref(links, "dp-shop", "qa")).toBe("/projects/p-shop-fe#qa");
    expect(projectStudioHref(links, "dp-pay", "po")).toBe("/projects/p-pay-be#po");
  });

  it("opens the Project page when no repository is linked yet", () => {
    expect(projectStudioHref(links, "dp-new", "qa")).toBe("/groups/ws%201/delivery-projects/dp-new");
    const unlinked = homeLinkContext("ws-1", [folder({ deliveryProjectId: "dp-x", name: "X", repositories: [repository("x", null)] })]);
    expect(projectStudioHref(unlinked, "dp-x", "po")).toBe("/groups/ws-1/delivery-projects/dp-x");
    expect(projectStudioHref(unlinked, "dp-unknown", "po")).toBe("/groups/ws-1/delivery-projects/dp-unknown");
  });
});

describe("an empty team", () => {
  const ready = { status: "ready" as const, error: null };
  const states = (folders: HomeSectionStates["folders"]["status"]) => ({
    projects: ready,
    folders: { status: folders, error: folders === "error" ? "x" : null },
  });

  it("shows the journey to whoever can start it, and a waiting card to who cannot", () => {
    expect(homeEmptyStateFor("product-owner")).toBe("journey");
    expect(homeEmptyStateFor("team")).toBe("journey");
    expect(homeEmptyStateFor("developer")).toBe("waiting");
    expect(homeEmptyStateFor("qa")).toBe("waiting");
  });

  it("is empty with no repositories and no Projects, once both are read", () => {
    expect(isPersonaHomeEmpty({ states: states("ready"), projectCount: 0, teamProjectCount: 0 })).toBe(true);
    expect(isPersonaHomeEmpty({ states: states("loading"), projectCount: 0, teamProjectCount: 0 })).toBe(false);
    expect(isPersonaHomeEmpty({ states: states("ready"), projectCount: 0, teamProjectCount: 1 })).toBe(false);
    expect(isPersonaHomeEmpty({ states: states("ready"), projectCount: 1, teamProjectCount: 0 })).toBe(false);
  });

  it("never calls a team empty because its Projects failed to load", () => {
    expect(isPersonaHomeEmpty({ states: states("error"), projectCount: 0, teamProjectCount: 0 })).toBe(false);
  });
});
