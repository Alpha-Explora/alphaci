import {
  headerTeam,
  linkedProjectFolderId,
  newProjectHref,
  nextMenuIndex,
  nextNewProjectTeam,
  readProjectsDeepLink,
  teamProjectsHref,
} from "../../../../../../src/features/workflows/studio/model/current-projects-rules";
import { searchWithoutTab } from "../../../../../../src/features/workflows/studio/model/workflow-studio-rules";

const TEAMS = [
  { id: "g-1", name: "Team Blaine" },
  { id: "g-2", name: "Johns Kitchen" },
  { id: "g-3", name: "Platform" },
];

function link(search: string) {
  return readProjectsDeepLink(new URLSearchParams(search));
}

describe("headerTeam", () => {
  it("is the header's selection when the list has it", () => {
    expect(headerTeam(TEAMS, "g-2")?.id).toBe("g-2");
  });

  it("falls back to the first team while the header has nothing this list knows", () => {
    expect(headerTeam(TEAMS, null)?.id).toBe("g-1");
    expect(headerTeam(TEAMS, "gone")?.id).toBe("g-1");
  });

  it("is null with no teams", () => {
    expect(headerTeam([], "g-1")).toBeNull();
  });
});

describe("readProjectsDeepLink", () => {
  it("reads ?group=, ?project= and whether it is a wizard link", () => {
    expect(link("group=g-1&project=dp-1")).toEqual({
      groupId: "g-1",
      projectId: "dp-1",
      opensSetup: false,
      opensNewProject: false,
    });
    expect(link("tab=setup&group=g-1&project=dp-1").opensSetup).toBe(true);
  });

  it("drops malformed ids and treats blanks as absent", () => {
    expect(link("group=a%20b&project=dp%262")).toEqual({
      groupId: null,
      projectId: null,
      opensSetup: false,
      opensNewProject: false,
    });
    expect(link("group=&project=%20%20")).toEqual({
      groupId: null,
      projectId: null,
      opensSetup: false,
      opensNewProject: false,
    });
  });
});

describe("linkedProjectFolderId", () => {
  it("opens the linked Project on the team the link names", () => {
    expect(linkedProjectFolderId(link("group=g-1&project=dp-1"), "g-1")).toBe("dp-1");
  });

  it("opens it on whichever team is shown when the link names none", () => {
    expect(linkedProjectFolderId(link("project=dp-1"), "g-3")).toBe("dp-1");
  });

  it("never opens a same-id Project on another team", () => {
    expect(linkedProjectFolderId(link("group=g-1&project=dp-1"), "g-2")).toBeNull();
  });

  /* The wizard reads ?project= as where to create, not as what to open. */
  it("ignores a wizard link's ?project=", () => {
    expect(linkedProjectFolderId(link("tab=setup&group=g-1&project=dp-1"), "g-1")).toBeNull();
  });

  it("opens nothing without a Project", () => {
    expect(linkedProjectFolderId(link("group=g-1"), "g-1")).toBeNull();
  });
});

describe("nextMenuIndex", () => {
  it("wraps with the arrow keys", () => {
    expect(nextMenuIndex("ArrowDown", 0, 2)).toBe(1);
    expect(nextMenuIndex("ArrowDown", 1, 2)).toBe(0);
    expect(nextMenuIndex("ArrowUp", 0, 2)).toBe(1);
    expect(nextMenuIndex("ArrowUp", 1, 2)).toBe(0);
  });

  it("enters from nothing at the near end", () => {
    expect(nextMenuIndex("ArrowDown", -1, 2)).toBe(0);
    expect(nextMenuIndex("ArrowUp", -1, 2)).toBe(1);
  });

  it("jumps with Home and End", () => {
    expect(nextMenuIndex("Home", 1, 3)).toBe(0);
    expect(nextMenuIndex("End", 0, 3)).toBe(2);
  });

  it("ignores other keys and empty menus", () => {
    expect(nextMenuIndex("a", 0, 2)).toBeNull();
    expect(nextMenuIndex("Enter", 0, 2)).toBeNull();
    expect(nextMenuIndex("ArrowDown", 0, 0)).toBeNull();
  });
});

describe("searchWithoutTab", () => {
  it("removes tab and keeps the rest", () => {
    expect(searchWithoutTab("tab=setup&group=g-1")).toBe("group=g-1");
    expect(searchWithoutTab("tab=setup")).toBe("");
  });
});

describe("newProjectHref", () => {
  it("links the Projects page with the New Project dialog open", () => {
    expect(newProjectHref()).toBe("/workflows?new=project");
    expect(newProjectHref(null)).toBe("/workflows?new=project");
    expect(newProjectHref("g-1")).toBe("/workflows?group=g-1&new=project");
  });

  it("is what readProjectsDeepLink reads back", () => {
    const link = readProjectsDeepLink(new URLSearchParams("group=g-1&new=project"));
    expect(link).toMatchObject({ groupId: "g-1", opensNewProject: true, opensSetup: false });
    expect(readProjectsDeepLink(new URLSearchParams("new=other")).opensNewProject).toBe(false);
  });
});

describe("teamProjectsHref", () => {
  it("links the Projects page on one team, as readProjectsDeepLink reads it back", () => {
    expect(teamProjectsHref("g-1")).toBe("/workflows?group=g-1");
    expect(readProjectsDeepLink(new URLSearchParams("group=g-1")).groupId).toBe("g-1");
  });
});

describe("nextNewProjectTeam", () => {
  it("binds to the first team the page shows", () => {
    expect(nextNewProjectTeam(undefined, null)).toBeUndefined();
    expect(nextNewProjectTeam(undefined, "g-1")).toBe("g-1");
    expect(nextNewProjectTeam("g-1", "g-1")).toBe("g-1");
  });

  it("is spent once the page moves to another team, and stays spent", () => {
    expect(nextNewProjectTeam("g-1", "g-2")).toBeNull();
    expect(nextNewProjectTeam(null, "g-1")).toBeNull();
  });

  it("waits while there is no team on screen", () => {
    expect(nextNewProjectTeam("g-1", null)).toBe("g-1");
  });
});
